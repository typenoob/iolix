import { decryptResponse, encryptParams, PLATFORM } from './crypto.js';

const REQUEST_PATH = 'api/v2/movie/selectMovieInformation';
const DEFAULT_TIMEOUT_MS = 10_000;
// 上游会对非常规 UA 直接返回 403，默认伪装成 iOS 客户端（可用 env.USER_AGENT 覆盖）
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * 拉取单部影片信息，返回上游解密后的 JSON（形如 { code, object }）
 * @param {number} id 影片编号
 * @param {{ API_BASE: string, [k: string]: any }} env Worker 环境变量
 * @param {number} episodeNum 剧集号，沿用历史逻辑固定为 -1
 */
export async function fetchMovie(id, env, episodeNum = -1) {
  const base = env.API_BASE || 'http://fx.meiying.cool/api/';
  const { body, timestamp } = await encryptParams({ id, episodeNum });

  const response = await fetch(new URL(REQUEST_PATH, base), {
    method: 'POST',
    headers: {
      'x-mflix-ts': String(timestamp),
      'x-mflix-deviceId': PLATFORM,
      'x-mflix-platform': PLATFORM,
      'Content-Type': 'application/plain',
      'User-Agent': env.USER_AGENT || DEFAULT_USER_AGENT,
    },
    body,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`上游返回 ${response.status}（id=${id}）`);
  }

  return decryptResponse(await response.text());
}
