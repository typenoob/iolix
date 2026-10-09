import { fetchMovie } from './movieinfo.js';

const KEY_DB = 'db';
const KEY_CURSOR = 'sync:cursor';
const KEY_LOCK = 'sync:lock';
const KEY_EMPTY = 'sync:empty'; // 上游明确返回“无此影片”的 ID，记下来后不再重复重试

const LOCK_TTL_SECONDS = 900; // 异常退出后锁自动过期，避免永久死锁
const DEFAULT_BATCH_SIZE = 60;
const DEFAULT_MAX_ID = 15000;
// 每天只跑一次，单次运行连续跑多批直到用完预算，避免一天仅推进一批
// 上限还受 Workers 单次调用 1000 个子请求限制约束：12 批 × 60 个上游请求 + 3 次 KV 仍有余量
const DEFAULT_MAX_BATCHES = 12;
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
 * 从 start 开始收集未收录、且未确认为无数据的 ID
 * 扫到 maxId 后回到 1 继续，直到凑满一批或完整绕一圈
 */
export function collectIds(known, empty, start, batchSize, maxId) {
  const ids = [];
  let cursor = start > maxId ? 1 : start;
  let wrapped = false;

  while (ids.length < batchSize) {
    if (!known.has(cursor) && !empty.has(cursor)) ids.push(cursor);
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
 * 执行一轮增量爬取：整轮只加载一次整库，各批次在内存中累积，收尾时统一写回。
 *
 * 为什么不再“每批读写整库”：批次之间只隔几秒，而 KV 写入存在传播延迟，后一批很可能
 * 读到前一批写入前的旧快照，再把旧快照整体覆盖回去，刚抓到的影片就被抹掉了。
 * 418/419/420 上游一直有数据、游标也绕了 57 圈，却始终进不了库，就是这个原因。
 *
 * 另外把上游明确返回“无此影片”的 ID 记进 KEY_EMPTY，之后不再重复重试；
 * 否则每圈都要在这批死号上耗尽配额，游标推进极慢。
 *
 * @returns {Promise<{ batches: number, scanned: number, added: number, missing: number, failed: number, next: number, round: number, total: number, stoppedReason: string }>}
 */
export async function runCrawl(env, options = {}) {
  const batchSize = toPositiveInt(options.batchSize ?? env.BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const maxId = toPositiveInt(options.maxId ?? env.MAX_ID, DEFAULT_MAX_ID);
  const maxBatches = toPositiveInt(options.maxBatches ?? env.MAX_BATCHES, DEFAULT_MAX_BATCHES);
  const timeBudgetMs = toPositiveInt(options.timeBudgetMs ?? env.TIME_BUDGET_MS, DEFAULT_TIME_BUDGET_MS);
  const playBase = env.PLAY_BASE || 'http://fx.meiying.cool/';

  const startedAt = Date.now();

  const db = normalizeDb(await readJson(env, KEY_DB, null));
  const known = new Set(db.movies.map((movie) => movie.id));
  const empty = new Set(await readJson(env, KEY_EMPTY, []));
  const cursor = await readJson(env, KEY_CURSOR, { next: 1, round: 0, updatedAt: null });

  let next = toPositiveInt(cursor.next, 1);
  let round = Number.isFinite(cursor.round) ? cursor.round : 0;

  let batches = 0;
  let scanned = 0;
  let added = 0;
  let missing = 0;
  let failed = 0;
  const failedIds = [];
  let stoppedReason = 'budget';

  while (batches < maxBatches) {
    if (Date.now() - startedAt >= timeBudgetMs) {
      stoppedReason = 'time';
      break;
    }

    const picked = collectIds(known, empty, next, batchSize, maxId);
    next = picked.next;
    if (picked.wrapped) round += 1;

    if (picked.ids.length === 0) {
      stoppedReason = 'caught-up'; // 整圈扫完仍没有待抓 ID
      break;
    }

    const ids = picked.ids;
    const results = await Promise.allSettled(ids.map((id) => fetchMovie(id, env)));
    scanned += ids.length;

    results.forEach((result, index) => {
      const id = ids[index];
      const data = result.status === 'fulfilled' ? result.value : null;

      if (data && data.code === 0 && data.object) {
        const { id: movieId, title, imageurl } = data.object;
        const finalId = Number.isFinite(movieId) ? movieId : id;
        db.movies.push({ id: finalId, title, imageurl, url: `${playBase}#/home/${finalId}/-1` });
        known.add(finalId);
        empty.delete(finalId);
        db.last = Math.max(db.last || 0, finalId);
        added += 1;
        return;
      }

      if (data && data.code !== 0) {
        empty.add(id); // 上游确认无此影片，后续不再重试
        missing += 1;
        return;
      }

      failed += 1; // 网络或解析错误：不标记，下一圈自然重试
      if (failedIds.length < 20) failedIds.push(id);
    });

    batches += 1;
  }

  db.movies.sort((a, b) => a.id - b.id);
  db.total = db.movies.length;
  db.updatedAt = new Date().toISOString();

  await env.MOVIE_DB.put(KEY_DB, JSON.stringify(db));
  await env.MOVIE_DB.put(KEY_EMPTY, JSON.stringify([...empty].sort((a, b) => a - b)));
  await env.MOVIE_DB.put(KEY_CURSOR, JSON.stringify({ next, round, updatedAt: db.updatedAt }));

  log('info', {
    msg: '爬取轮次完成',
    batches,
    scanned,
    added,
    missing,
    failed,
    failedIds,
    total: db.total,
    next,
    round,
    emptySize: empty.size,
    stoppedReason,
    elapsedMs: Date.now() - startedAt,
  });

  return { batches, scanned, added, missing, failed, next, round, total: db.total, stoppedReason };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ping') {
      return Response.json({ ok: true, note: 'reachable, no upstream call' });
    }
    const id = Number(url.searchParams.get('id') ?? '418');
    try {
      const data = await fetchMovie(id, env);
      return Response.json({ id, ok: true, data });
    } catch (error) {
      return Response.json({ id, ok: false, error: String(error) });
    }
  },
  async scheduled(event, env) {
    const startedAt = Date.now();

    if (await env.MOVIE_DB.get(KEY_LOCK)) {
      log('info', { msg: '上一轮尚未结束，本次跳过', cron: event.cron });
      return;
    }

    try {
      await env.MOVIE_DB.put(KEY_LOCK, '1', { expirationTtl: LOCK_TTL_SECONDS });
      const summary = await runCrawl(env);
      log('info', {
        msg: 'scheduled 完成',
        cron: event.cron,
        ...summary,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      log('error', { msg: 'scheduled 失败', cron: event.cron, error: String(error) });
    } finally {
      await env.MOVIE_DB.delete(KEY_LOCK).catch(() => {});
    }
  },
};
