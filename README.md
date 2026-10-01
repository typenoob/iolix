# iolix

## 简介

爬取某网站的电影信息，提供标题、海报与播放链接。前端是 Vue 3 单页应用，数据存放在 Cloudflare Workers KV，由 Cloudflare Pages 托管并提供服务端分页与搜索接口。

## 架构

| 组成 | 位置 | 说明 |
| --- | --- | --- |
| 前端静态资源 | `src/` → `dist/` | Vue 3 + vue-cli 构建，托管在 Cloudflare Pages |
| 数据接口 | `functions/api/*` | Pages Functions（`/api/movies`、`/api/search`、`/api/meta`） |
| 数据存放 | Workers KV（绑定名 `MOVIE_DB`） | 整库单 key `db`，另有 `sync:cursor`、`sync:lock` 两个辅助 key |
| 定时爬取 | `crawler/` | 独立 Worker + Cron Triggers，每 10 分钟增量爬取一批 |

读取链路：浏览器 → Pages 静态资源 → `/api/*` → KV 读 `db`（模块级快照缓存 5 分钟）→ 边缘切片 → 返回数 KB JSON。
写入链路：Cron → 加锁 → 读库建索引 → 抓一批缺失 ID → 写回 `db` 与游标 → 释放锁。

> Pages Functions 只有 `fetch` handler，不支持 `scheduled`，所以爬取逻辑单独部署为 Worker，两个项目绑定同一个 KV namespace。

## 数据模型

KV key `db` 的值：

```json
{ "last": 11230, "total": 10938, "updatedAt": "2026-10-01T05:00:00.000Z", "movies": [{ "id": 45, "title": "摔角小将", "imageurl": "https://...", "url": "http://fx.meiying.cool/#/home/45/-1" }] }
```

| key | 说明 |
| --- | --- |
| `db` | 整库，约 2.2 MB（单键上限 25 MiB） |
| `sync:cursor` | `{ next, round, updatedAt }`，扫到 `MAX_ID` 后回到 1 并 `round + 1` |
| `sync:lock` | 值为 `"1"`，TTL 900 秒，防止上一批未跑完被重复触发 |

接口约定：

| 接口 | 参数 | 返回 |
| --- | --- | --- |
| `GET /api/movies` | `page`（默认 1）、`size`（默认 8，上限 24） | `{ total, page, size, items }` |
| `GET /api/search` | `q`（标题包含匹配）、`limit`（默认 8，上限 24） | `{ total, items }` |
| `GET /api/meta` | 无 | `{ last, total, updatedAt }` |

## 本地开发

```bash
npm install
npm run build          # 产出 dist/
npm run pages:dev      # wrangler pages dev，默认 http://127.0.0.1:8788（已含本地 KV 数据）
npm run serve          # 前端开发服务器 http://127.0.0.1:8080，/api 已代理到 8788
```

本地 KV 数据落在 `.wrangler/`（已 gitignore）。首次使用时写入一份数据：

```bash
npx wrangler kv key put db --path=db.json --binding=MOVIE_DB --local
```

手动触发一次爬取（本地）：

```bash
npm run crawler:dev
curl "http://127.0.0.1:8788/__scheduled?cron=*%2F10+*+*+*+"
```

## Cloudflare 部署

首次配置（需要 Workers **Paid** 计划：解析 2.2 MB JSON 会超出 Free 计划 10 ms 的 CPU 上限）：

1. `npx wrangler login`
2. 创建 KV namespace：`npm run kv:create`，把输出的 id 填进 `wrangler.toml` 与 `crawler/wrangler.toml` 的 `[[kv_namespaces]]`
3. 一次性导入历史数据（数据文件已从仓库移除，从迁移前的提交恢复即可）：
   ```bash
   git show <迁移前的 commit>:db.json > db.json
   npm run kv:import
   rm db.json
   ```
4. 创建 Pages 项目：Dashboard 连接本仓库，构建命令 `npm run build`，输出目录 `dist`；或本地执行 `npm run pages:deploy`
5. 绑定 KV：Pages 项目 → Settings → Functions → KV namespace bindings，变量名 `MOVIE_DB`，值选 `iolix-db`
6. 部署爬虫：`npm run crawler:deploy`
7. 验证：访问 `https://<pages 域名>/api/meta`，`total` 应与导入条数一致

日常运维：

```bash
npm run crawler:tail   # 查看爬取日志（批次区间、新增条数、失败 ID）
```

## 爬取机制

- 每 10 分钟触发一次，每次只处理 `BATCH_SIZE`（默认 60）个未收录的 ID，参数在 `crawler/wrangler.toml` 的 `[vars]` 中调整
- 已存在的 ID 直接跳过，因此可安全重复执行；扫到 `MAX_ID`（默认 15000）后回到 1 继续增量扫描
- 单个 ID 请求超时 10 秒，失败仅记录不中断批次（`Promise.allSettled`）
- 上游接口使用 AES-128-CBC（key = iv = `timestamp + "iOS"`），实现见 `crawler/src/crypto.js`

## 回滚

KV 数据独立于 Git，前端可随时回滚到历史版本。若需临时回到「全量 JSON」模式，把 `src/components/MainPage.vue` 的数据源改回 raw 地址即可。

## 其他命令

```bash
npm run lint
```
