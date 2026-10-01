import { getSnapshot, json, paginate, withCache } from '../_lib/db.js';

export async function onRequestGet({ request, env, waitUntil }) {
  const params = new URL(request.url).searchParams;
  const db = await getSnapshot(env);
  const result = paginate(db, params.get('page'), params.get('size'));
  return withCache(request, { waitUntil }, () => json(result));
}
