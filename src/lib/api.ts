import axios from 'axios';
import type { AxiosInstance } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Injected by authStore after creation to avoid circular dep
let _getToken: (() => string | null) | null = null;
let _setToken: ((t: string) => void) | null = null;
let _setUser: ((u: unknown) => void) | null = null;
let _clearAuth: (() => void) | null = null;

export function injectAuthHooks(
  getToken: () => string | null,
  setToken: (t: string) => void,
  clearAuth: () => void,
  setUser?: (u: unknown) => void,
) {
  _getToken = getToken;
  _setToken = setToken;
  _clearAuth = clearAuth;
  _setUser = setUser ?? null;
}

// ── Request interceptor: attach Bearer token ───────────────────────
api.interceptors.request.use((config) => {
  const token = _getToken?.();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: silent token refresh on 401 ─────────────
let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise<string>((resolve) =>
          queue.push(resolve),
        ).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken: string = data.data.accessToken;
        _setToken?.(newToken);
        _setUser?.(data.data.user);
        queue.forEach((cb) => cb(newToken));
        queue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        _clearAuth?.();
        queue = [];
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  },
);

export default api;
