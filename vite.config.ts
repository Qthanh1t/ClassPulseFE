import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // When VITE_API_BASE_URL is relative (e.g. /api/v1), the browser sends requests
  // to the Vite dev server, which proxies them to VITE_BACKEND_TARGET.
  // When VITE_API_BASE_URL is absolute, derive target from it (backward compat).
  const apiBase = env.VITE_API_BASE_URL ?? ''
  const backendTarget =
    env.VITE_BACKEND_TARGET ||
    (apiBase.startsWith('http') ? apiBase.replace(/\/api\/v1\/?$/, '') : 'http://localhost:8080')

  return {
    plugins: [react(), tailwindcss()],
    define: {
      global: 'globalThis',
    },
    server: {
      proxy: {
        // All /api requests go through Vite → backend.
        // Cookies are always set on the browser's current origin (same-site),
        // so SameSite=Lax on the refresh_token cookie works regardless of
        // whether the frontend is on localhost or a LAN IP.
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // SockJS WebSocket + HTTP long-polling fallbacks all live under /ws.
        // With ws:true Vite upgrades the connection transparently.
        // This replaces the old requirement for an absolute VITE_WS_URL.
        '/ws': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  }
})
