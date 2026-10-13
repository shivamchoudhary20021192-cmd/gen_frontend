import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'

/**
 * Where /admin/api, /media and /health are forwarded.
 *
 * Resolved through `loadEnv` so a `.env.local` file works. That matters more
 * than it looks: inside vite.config.ts, a bare `process.env.VITE_PROXY_TARGET`
 * reads ONLY a real OS environment variable — Vite's .env loading feeds
 * `import.meta.env` for client code, never `process.env` here. Pointing a local
 * frontend at a deployed backend therefore used to mean setting a shell
 * variable that nothing on screen ever confirmed.
 *
 * Precedence, highest first:
 *   1. VITE_PROXY_TARGET exported in the shell  (one-off override)
 *   2. VITE_PROXY_TARGET in .env.local          (the normal way — a file you can see)
 *   3. http://127.0.0.1:4000                    (a backend running on this machine)
 *
 * The default stays local on purpose: a deployed address hardcoded here would
 * quietly break every fresh clone.
 */
const DEFAULT_TARGET = 'http://127.0.0.1:4000'

// https://vite.dev/config/
export default defineConfig(({ mode, command, isPreview }) => {
  /**
   * The admin is served at https://veylor.co.in/admin/ in production, so every
   * asset URL Vite writes into index.html has to be prefixed. Without this the
   * built page asks for /assets/index-abc.js, nginx hands that to the main
   * site's SPA fallback, and the browser gets index.html where JavaScript was
   * expected — a blank screen and "Unexpected token '<'".
   *
   * Build only: `npm run dev` keeps serving from / so the dev URL and the smoke
   * scripts are unchanged. `import.meta.env.BASE_URL` follows this value, which
   * is what the router's basename reads, so the two can never drift apart.
   *
   * `vite preview` reports command === 'serve', so it has to be named
   * separately: without `isPreview` it served the built bundle at / while that
   * bundle's index.html asked for /admin/assets/index-*.js, and the only
   * symptom was a blank page — the fallback answered with index.html and the
   * browser refused it as a script.
   */
  const base = command === 'build' || isPreview ? '/admin/' : '/'

  // '' as the prefix loads every key, not just VITE_-prefixed ones.
  const fileEnv = loadEnv(mode, process.cwd(), '')

  const fromShell = process.env.VITE_PROXY_TARGET
  const fromFile = fileEnv.VITE_PROXY_TARGET
  const API_TARGET = fromShell || fromFile || DEFAULT_TARGET
  const TARGET_SOURCE = fromShell
    ? 'VITE_PROXY_TARGET in your shell'
    : fromFile
      ? 'VITE_PROXY_TARGET in .env.local'
      : 'the default in vite.config.ts'

  /**
   * Chrome attaches an `Origin` header to every POST/PATCH/DELETE — including
   * same-origin ones — and the proxy forwards it verbatim. The API's CORS check
   * then sees `http://localhost:5173`, which is not in its allowlist, and
   * rejects the request before it reaches a route.
   *
   * The proxy hop is server-to-server, so the browser's Origin is meaningless
   * upstream. Dropping it makes the API treat these as same-origin calls, which
   * is what they are from its point of view — and it means nobody has to edit
   * CORS_ORIGINS in the backend .env to run the dev server, whether the backend
   * is on localhost or on EC2.
   */
  const stripOrigin: ProxyOptions['configure'] = (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      proxyReq.removeHeader('origin')
    })

    // Node's raw proxy error is a bare errno against an IP with no context, and
    // the distinction between the two common ones is the whole diagnosis.
    proxy.on('error', (error: NodeJS.ErrnoException, req) => {
      const hint =
        error.code === 'ETIMEDOUT'
          ? 'packets are being dropped — a firewall or AWS security group is not allowing this port from your machine'
          : error.code === 'ECONNREFUSED'
            ? 'the host answered but nothing is listening on that port'
            : error.code === 'ENOTFOUND'
              ? 'that hostname does not resolve'
              : error.message

      console.error(
        `\n  ✗ proxy ${req.url ?? ''} → ${API_TARGET}\n` +
          `    ${error.code ?? 'error'}: ${hint}\n` +
          `    target came from: ${TARGET_SOURCE}\n`,
      )
    })
  }

  /**
   * Prints the resolved target once at startup.
   *
   * The browser's Request URL always reads localhost:5173 when a proxy is in
   * play — that is the proxy working, not failing — so this line is the only
   * honest answer to "which backend am I actually talking to?".
   */
  const announceTarget: Plugin = {
    name: 'veylog-announce-proxy-target',
    configureServer(server) {
      const original = server.printUrls.bind(server)
      server.printUrls = () => {
        original()
        console.log(`  ➜  API proxy:  ${API_TARGET}  (${TARGET_SOURCE})\n`)
      }
    },
  }

  return {
    base,
    plugins: [react(), announceTarget],
    server: {
      port: 5173,
      /**
       * Both paths are proxied so the browser only ever talks to one origin in
       * development: no CORS preflight, no CORS_ORIGINS edit on the backend, and
       * relative media URLs (`/media/2026/09/…`) resolve without the frontend
       * having to know the API host.
       */
      proxy: {
        '/admin/api': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
        '/media': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
        '/health': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
        // Store signup and the operators' API.
        '/platform': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
      },
    },
    /**
     * `vite preview` does not inherit `server.proxy`, so without this the built
     * bundle loads and then every API call 404s against the static server. That
     * matters because the built bundle is the only thing that exercises the
     * production `base`, the minifier and the real chunk graph — a module that
     * compiles and runs under `npm run dev` can still fail here.
     */
    preview: {
      port: 4173,
      proxy: {
        '/admin/api': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
        '/media': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
        '/health': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
        // Store signup and the operators' API.
        '/platform': { target: API_TARGET, changeOrigin: true, configure: stripOrigin },
      },
    },
  }
})
