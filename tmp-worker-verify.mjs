// 临时验证：worker/index.js 路由与静态资源回落
import worker from './worker/index.js';

const env = {
  MOVIE_DB: {
    async get(key, type) {
      if (key !== 'db') return null;
      const data = {
        last: 3,
        updatedAt: '2026-01-01T00:00:00.000Z',
        movies: [{ id: 1, title: '电影A' }, { id: 2, title: '电影B' }, { id: 3, title: 'ABC' }],
      };
      return type === 'json' ? data : JSON.stringify(data);
    },
  },
};
const ctx = { waitUntil() {} };

for (const path of ['/api/meta', '/api/movies?page=1&size=2', '/api/search?q=电影']) {
  const res = await worker.fetch(new Request('https://example.com' + path), env, ctx);
  console.log(path, '->', res.status, (await res.text()).slice(0, 120));
}
