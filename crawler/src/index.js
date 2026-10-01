import { fetchMovie } from './movieinfo.js';

const KEY_DB = 'db';
const KEY_CURSOR = 'sync:cursor';
const KEY_LOCK = 'sync:lock';

const LOCK_TTL_SECONDS = 900; // 异常退出后锁自动过期，避免永久死锁
const DEFAULT_BATCH_SIZE = 60;
const DEFAULT_MAX_ID = 15000;
// 每天只跑一次，单次运行连续跑多批直到用完预算，避免一天仅推进一批
const DEFAULT_MAX_BATCHES = 30;
const DEFAULT_TIME_BUDGET_MS = 45_000;

function log(level, payload) {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...payload });
  if (level === 'error') console.error(line);
  else console.log(line);
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** 兼容两种历史形态：导入的 db.json（{ database: {...} }）与线上规范形态（{ movies: [...] }） */
export function normalizeDb(raw) {
  const source = raw?.database ?? raw ?? {};
  const movies = Array.isArray(source.movies) ? source.movies : [];
  return {
    last: Number.isFinite(source.last) ? source.last : 0,
    total: movies.length,
    updatedAt: source.updatedAt ?? null,
    movies,
  };
}

async function readJson(env, key, fallback) {
  try {
    const value = await env.MOVIE_DB.get(key, 'json');
    return value == null ? fallback : value;
  } catch (error) {
    log('error', { msg: '读取 KV 失败', key, error: String(error) });
    return fallback;
  }
}

/**
 * 从 start 开始收集未收录的 ID，扫到 maxId 后回到 1 继续，直到凑满一批或完整绕一圈
 */
export function collectIds(known, start, batchSize, maxId) {
  const ids = [];
  let cursor = start > maxId ? 1 : start;
  let wrapped = false;

  while (ids.length < batchSize) {
    if (!known.has(cursor)) ids.push(cursor);
    cursor += 1;
    if (cursor > maxId) {
      cursor = 1;
      wrapped = true;
    }
    if (wrapped && cursor >= start) break; // 已绕回起点，说明全部 ID 都已收录
  }

  return { ids, next: cursor, wrapped };
}

/**
 * 执行一批增量爬取：读库 → 抓缺失 ID → 写回整库与游标
 * @returns {Promise<{ scanned: number, added: number, failed: number, next: number, total: number }>}
 */
export async function runBatch(env, options = {}) {
  const batchSize = toPositiveInt(options.batchSize ?? env.BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const maxId = toPositiveInt(options.maxId ?? env.MAX_ID, DEFAULT_MAX_ID);
  const playBase = env.PLAY_BASE || 'http://fx.meiying.cool/';

  const db = normalizeDb(await readJson(env, KEY_DB, null));
  const cursor = await readJson(env, KEY_CURSOR, { next: 1, round: 0, updatedAt: null });
  const known = new Set(db.movies.map((movie) => movie.id));

  const { ids, next, wrapped } = collectIds(known, toPositiveInt(cursor.next, 1), batchSize, maxId);
  const startedAt = Date.now();

  if (ids.length === 0) {
    await env.MOVIE_DB.put(
      KEY_CURSOR,
      JSON.stringify({ next, round: (cursor.round ?? 0) + (wrapped ? 1 : 0), updatedAt: new Date().toISOString() }),
    );
    log('info', { msg: '本批无可抓取的新 ID', total: db.movies.length, next });
    return { scanned: 0, added: 0, failed: 0, next, total: db.movies.length };
  }

  const results = await Promise.allSettled(ids.map((id) => fetchMovie(id, env)));

  let added = 0;
  let failed = 0;
  const failedIds = [];

  results.forEach((result, index) => {
    const id = ids[index];
    const data = result.status === 'fulfilled' ? result.value : null;
    if (data && data.code === 0 && data.object) {
      const { id: movieId, title, imageurl } = data.object;
      const finalId = Number.isFinite(movieId) ? movieId : id;
      db.movies.push({ id: finalId, title, imageurl, url: `${playBase}#/home/${finalId}/-1` });
      known.add(finalId);
      db.last = Math.max(db.last || 0, finalId);
      added += 1;
      return;
    }
    failed += 1;
    if (failedIds.length < 20) failedIds.push(id);
  });

  db.movies.sort((a, b) => a.id - b.id);
  db.total = db.movies.length;
  db.updatedAt = new Date().toISOString();

  await env.MOVIE_DB.put(KEY_DB, JSON.stringify(db));
  await env.MOVIE_DB.put(
    KEY_CURSOR,
    JSON.stringify({ next, round: (cursor.round ?? 0) + (wrapped ? 1 : 0), updatedAt: db.updatedAt }),
  );

  log('info', {
    msg: '批次完成',
    range: [ids[0], ids[ids.length - 1]],
    scanned: ids.length,
    added,
    failed,
    failedIds,
    total: db.total,
    next,
    round: (cursor.round ?? 0) + (wrapped ? 1 : 0),
    elapsedMs: Date.now() - startedAt,
  });

  return { scanned: ids.length, added, failed, next, total: db.total };
}

export default {
  async scheduled(event, env) {
    const startedAt = Date.now();

    if (await env.MOVIE_DB.get(KEY_LOCK)) {
      log('info', { msg: '上一批尚未结束，本次跳过', cron: event.cron });
      return;
    }

    const maxBatches = toPositiveInt(env.MAX_BATCHES, DEFAULT_MAX_BATCHES);
    const timeBudgetMs = toPositiveInt(env.TIME_BUDGET_MS, DEFAULT_TIME_BUDGET_MS);

    try {
      await env.MOVIE_DB.put(KEY_LOCK, '1', { expirationTtl: LOCK_TTL_SECONDS });

      let batches = 0;
      let added = 0;
      let failed = 0;
      let stoppedReason = 'budget';

      while (batches < maxBatches) {
        if (Date.now() - startedAt >= timeBudgetMs) {
          stoppedReason = 'time';
          break;
        }
        const summary = await runBatch(env);
        batches += 1;
        added += summary.added;
        failed += summary.failed;
        if (summary.scanned === 0) {
          stoppedReason = 'caught-up'; // 已扫完一圈且无新 ID
          break;
        }
      }

      log('info', {
        msg: 'scheduled 完成',
        cron: event.cron,
        batches,
        added,
        failed,
        stoppedReason,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      log('error', { msg: 'scheduled 失败', cron: event.cron, error: String(error) });
    } finally {
      await env.MOVIE_DB.delete(KEY_LOCK).catch(() => {});
    }
  },
};
