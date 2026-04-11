import axios from "axios";

/** Backend mounts all REST routes under `/api`. Env often omits it (e.g. http://localhost:5000). */
function apiBaseURL(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw == null || String(raw).trim() === "") {
    return "/api";
  }
  const s = String(raw).replace(/\/+$/, "");
  if (s.startsWith("/")) {
    return s.endsWith("/api") ? s : `${s}/api`;
  }
  return s.endsWith("/api") ? s : `${s}/api`;
}

const api = axios.create({
  baseURL: apiBaseURL(),
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  // Many call sites use `/api/...` while baseURL already ends with `/api`; normalize to one `/api` segment.
  if (typeof config.url === "string" && config.url.startsWith("/api/")) {
    config.url = config.url.slice(4);
  }
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login?session=expired";
    }
    return Promise.reject(error);
  },
);

export default api;
