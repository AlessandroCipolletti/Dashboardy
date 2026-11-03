import { defineConfig, loadEnv, type ProxyOptions } from "vite"
import react from "@vitejs/plugin-react"

function appBase(mode: string): string {
  const fileEnv = loadEnv(mode, process.cwd(), "")
  const value = process.env.APP_BASE_PATH || fileEnv.APP_BASE_PATH || "/"
  const withLeading = value.startsWith("/") ? value : `/${value}`
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`
}

function apiProxy(base: string): Record<string, ProxyOptions> {
  const mount = base === "/" ? "" : base.slice(0, -1)
  return {
    [`${mount}/api`]: {
      target: "http://127.0.0.1:8080",
      changeOrigin: true,
      rewrite: mount ? (path) => path.slice(mount.length) || "/" : (path) => path,
    },
  }
}

export default defineConfig(({ mode }) => {
  const base = appBase(mode)
  return {
    base,
    plugins: [react()],
    server: { proxy: apiProxy(base) },
    preview: { proxy: apiProxy(base) },
  }
})
