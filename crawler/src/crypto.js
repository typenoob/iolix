// 上游接口使用 AES-128-CBC 加解密，本文件用 Web Crypto 复刻 src/api/request.js 中
// crypto-js 的行为（key = iv = Utf8(timestamp + "iOS")，Pkcs7 填充），零运行时依赖。

export const PLATFORM = 'iOS';

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importAesKey(aesKey) {
  const keyBytes = new TextEncoder().encode(aesKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt'],
  );
  return { cryptoKey, keyBytes };
}

/**
 * 加密请求参数，等价于 crypto-js 的 AES.encrypt(...).toString()
 * @returns {Promise<{ body: string, timestamp: number, aesKey: string }>} body 为 base64 密文
 */
export async function encryptParams(params, timestamp = Date.now()) {
  const aesKey = `${timestamp}${PLATFORM}`;
  const { cryptoKey, keyBytes } = await importAesKey(aesKey);
  const plaintext = new TextEncoder().encode(JSON.stringify(params));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: keyBytes }, cryptoKey, plaintext);
  return { body: bytesToBase64(new Uint8Array(cipher)), timestamp, aesKey };
}

/**
 * 解密响应体：上游返回 base64(密文) + 明文 aesKey（尾部 16 字符）
 */
export async function decryptResponse(text) {
  const payload = String(text).trim();
  if (payload.length <= 16) {
    throw new Error(`响应长度异常（${payload.length}），无法解析 aesKey`);
  }
  const aesKey = payload.slice(-16);
  const cipher = payload.slice(0, -16);
  const { cryptoKey, keyBytes } = await importAesKey(aesKey);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: keyBytes },
    cryptoKey,
    base64ToBytes(cipher),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
