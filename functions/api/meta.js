import { getSnapshot, json, withCache } from '../_lib/db.js';

export async function onRequestGet({ request, env, waitUntil }) {
  const db = await getSnapshot(env);
  const result = { last: db.last, total: db.total, updatedAt: db.updatedAt };
  return withCache(request, { waitUntil }, () => json(result));
}
