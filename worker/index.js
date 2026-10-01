// Worker 入口（源码直接提交，无需构建期编译）
// /api/* 走 KV 接口，其余请求回落到静态资源（dist）
import { onRequestGet as movies } from '../functions/api/movies.js';
import { onRequestGet as search } from '../functions/api/search.js';
import { onRequestGet as meta } from '../functions/api/meta.js';

const ROUTES = {
  '/api/movies': movies,
  '/api/search': search,
  '/api/meta': meta,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = ROUTES[pathname.replace(/\/+$/, '')];

    if (route) {
      try {
        return await route({
          request,
          env,
          waitUntil: ctx.waitUntil.bind(ctx),
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not Found', { status: 404 });
  },
};
