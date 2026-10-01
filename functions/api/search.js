import { getSnapshot, json, search, withCache } from '../_lib/db.js';

export async function onRequestGet({ request, env, waitUntil }) {
  const params = new URL(request.url).searchParams;
  const keyword = params.get('q') ?? '';
  const db = await getSnapshot(env);
  const result = search(db, keyword, params.get('limit'));
  return withCache(request, { waitUntil }, () => json(result));
}
