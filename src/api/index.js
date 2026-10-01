import axios from "axios";

// 同源调用 Pages Functions（生产为 Pages 域名下的 /api，本地由 devServer 代理到 wrangler）
const instance = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

export function getMovies(page = 1, size = 8) {
  return instance.get("/movies", { params: { page, size } }).then((res) => res.data);
}

export function searchMovies(q, limit = 8) {
  return instance.get("/search", { params: { q, limit } }).then((res) => res.data);
}

export function getMeta() {
  return instance.get("/meta").then((res) => res.data);
}
