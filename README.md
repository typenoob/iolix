# iolix

## 简介

爬取某网站的电影信息，提供标题、海报与播放链接。前端是 Vue 3 单页应用，部署为 Cloudflare Workers + Static Assets（新版 Pages），数据存放在 Workers KV，接口在边缘做分页与搜索。

线上地址：https://iolix.namu.cn.eu.org/ （Cloudflare 部署）

## 架构

| 组成 | 位置 | 说明 |
| --- | --- | --- |
| 前端静态资源 | `src/` → `dist/` | Vue 3 + vue-cli 构建，作为 Worker 的 `[assets]` 对外提供 |
| 数据接口 | `worker/index.js` + `functions/api/*` | `/api/movies`、`/api/search`、`/api/meta`；入口是仓库内源码，构建期无需编译 |
| 数据存放 | Workers KV（绑定名 `MOVIE_DB`） | 整库单 key `db`，另有 `sync:cursor`、`sync:lock` 两个辅助 key |
| 定时爬取 | `crawler/` | 独立 Worker + Cron Triggers，每天 UTC 18:00 增量爬取 |

读取链路：浏览器 → Worker 静态资源 → `/api/*` → KV 读 `db`（模块级快照 + 边缘缓存，TTL 60 秒）→ 边缘切片 → 返回数 KB JSON。
写入链路：Cron → 加锁 → 读库建索引 → 抓一批缺失 ID → 写回 `db` 与游标 → 释放锁。

> 编译出来的 Worker 只有 `fetch` handler，无法承载 `scheduled`，所以爬取逻辑单独部署为 Worker，两者绑定同一个 KV namespace。

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
npm run dev            # 编译 functions/ 并启动 wrangler dev（http://127.0.0.1:8787，含本地 KV 数据）
npm run serve          # 前端开发服务器 http://127.0.0.1:8080，/api 已代理到 8787
```

本地 KV 数据落在 `.wrangler/`（已 gitignore）。首次使用时写入一份数据：

```bash
git show <迁移前的 commit>:db.json > db.json
npx wrangler kv key put db --path=db.json --namespace-id=<namespace id> --local
rm db.json
```

手动触发一次爬取（本地）：

```bash
npm run crawler:dev
curl "http://127.0.0.1:8787/__scheduled?cron=0+18+*+*+*+"
```

## Cloudflare 部署

本项目按 **Workers + Static Assets**（即新版 Pages）部署：根 `wrangler.toml` 里 `main` 指向仓库内的 `worker/index.js`、
`[assets].directory` 指向 vue-cli 产出的 `dist`。`/api/*` 由 Worker 直接路由到 `functions/api/*`，其余请求回落到静态资源。

因此构建只需产出 `dist`，不再需要 `wrangler pages functions build` 之类的编译步骤。

首次配置（需要 Workers **Paid** 计划：解析 2.2 MB JSON 会超出 Free 计划 10 ms 的 CPU 上限）：

1. `npx wrangler login`
2. 创建 KV namespace：`npm run kv:create`，把输出的 id 填进根 `wrangler.toml` 与 `crawler/wrangler.toml` 的 `[[kv_namespaces]]`
3. 一次性导入历史数据（数据文件已从仓库移除，从迁移前的提交恢复即可）：
   ```bash
   git show <迁移前的 commit>:db.json > db.json
   npm run kv:import
   rm db.json
   ```
4. 连接 Git（Workers Builds）或本地部署：
   - Workers Builds 构建命令填 `npm run build`，部署命令 `npx wrangler deploy`
   - 或本地直接：`npm run deploy`
   - npm 12+ 默认不再放行依赖的安装脚本，`esbuild` / `workerd` 装不上会导致 `wrangler deploy` 打包失败。
     仓库已用 `package.json` 的 `allowScripts` 固定批准这四个包；依赖升级版本变化后重新固定：
     ```bash
     npm approve-scripts esbuild workerd core-js yorkie
     ```
5. 部署爬虫：`npm run crawler:deploy`
6. 验证：访问 `https://<worker 域名>/api/meta`，`total` 应与导入条数一致

> KV 绑定已在 `wrangler.toml` 中声明（变量名 `MOVIE_DB`），无需再到 Dashboard 单独绑定。

日常运维：

```bash
npm run crawler:tail   # 查看爬取日志（批次区间、新增条数、失败 ID）
```

## 爬取机制

- 每天 UTC 18:00（北京时间次日 02:00）触发一次，cron 在 `crawler/wrangler.toml` 的 `[triggers].crons` 中调整
- 单次运行会连续跑多批，每批处理 `BATCH_SIZE`（默认 60）个未收录的 ID，直到「扫完一圈无新 ID」/ 达到 `MAX_BATCHES`（默认 30）/ 超过 `TIME_BUDGET_MS`（默认 45 秒）
- 已存在的 ID 直接跳过（纯 `Set` 查找，推进极快），因此一天可扫完 `MAX_ID`（默认 15000）全量区间；扫到末尾后回到 1 继续增量扫描
- 单个 ID 请求超时 10 秒，失败仅记录不中断批次（`Promise.allSettled`）
- 上游接口使用 AES-128-CBC（key = iv = `timestamp + "iOS"`），实现见 `crawler/src/crypto.js`

## 回滚

KV 数据独立于 Git，前端可随时回滚到历史版本。若需临时回到「全量 JSON」模式，把 `src/components/MainPage.vue` 的数据源改回 raw 地址即可。

## 其他命令

```bash
npm run lint
```
