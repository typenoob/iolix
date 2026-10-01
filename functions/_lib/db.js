// Pages Functions 共享模块：KV 快照读取 + 纯函数切片 + 统一响应封装

const KEY_DB = 'db';
// 必须与 json() 的 s-maxage 保持一致。爬虫每轮都会写库，TTL 过长会让不同分页、
// 不同接口读到相差数分钟的快照，同一个会话里页数上下跳动
const SNAPSHOT_TTL_MS = 60 * 1000;
export const DEFAULT_PAGE_SIZE = 8;
export const MAX_PAGE_SIZE = 24;

let snapshotCache = { at: 0, data: null };

/** 兼容两种形态：一次性导入的 db.json（{ database: {...} }）与线上规范形态（{ movies: [...] }） */
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

export function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** 读取整库快照，命中模块级缓存时不再访问 KV */
export async function getSnapshot(env, ttlMs = SNAPSHOT_TTL_MS) {
  const now = Date.now();
  if (snapshotCache.data && now - snapshotCache.at < ttlMs) {
    return snapshotCache.data;
  }
  const data = normalizeDb(await env.MOVIE_DB.get(KEY_DB, 'json'));
  snapshotCache = { at: now, data };
  return data;
}

export function paginate(db, page, size) {
  const movies = db?.movies ?? [];
  const total = movies.length;
  const pageSize = clampInt(size, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(clampInt(page, 1, 1, Number.MAX_SAFE_INTEGER), maxPage);
  const start = (current - 1) * pageSize;
  return { total, page: current, size: pageSize, items: movies.slice(start, start + pageSize) };
}

export function search(db, q, limit) {
  const keyword = String(q ?? '').trim();
  if (!keyword) return { total: 0, items: [] };
  const max = clampInt(limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const matched = (db?.movies ?? []).filter((movie) => String(movie.title ?? '').includes(keyword));
  return { total: matched.length, items: matched.slice(0, max) };
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60',
      ...(init.headers ?? {}),
    },
  });
}

export function errorJson(message, status = 500) {
  return json({ error: message }, { status });
}

/** 用边缘缓存挡住重复请求，进一步降低 KV 读次数；缓存不可用时静默降级 */
export async function withCache(request, ctx, produce) {
  try {
    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await produce();
    if (response.status === 200) {
      ctx.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  } catch {
    return produce();
  }
}
