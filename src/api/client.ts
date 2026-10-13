import type { ApiErrorBody } from './types'

/**
 * In dev, Vite proxies /admin/api and /media to the backend, so the browser
 * only ever sees one origin — no CORS, and media URLs returned by the API
 * (which are relative, like /media/2026/09/…) just work.
 *
 * Set VITE_API_BASE to point at a different host in production.
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
const PREFIX = '/admin/api/v1'

const ACCESS_KEY = 'veylog.access_token'
const REFRESH_KEY = 'veylog.refresh_token'

export const tokenStore = {
  get access(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY)
    } catch {
      return null
    }
  },
  get refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  set(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access)
      localStorage.setItem(REFRESH_KEY, refresh)
    } catch {
      /* private mode — the session simply won't survive a reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      /* ignore */
    }
  },
}

/** Thrown for every non-2xx response, carrying the API's error envelope. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string
  readonly details?: Record<string, string[]> | Record<string, unknown>

  constructor(status: number, body: ApiErrorBody | null, fallback = 'Request failed') {
    super(body?.error?.message ?? fallback)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.error?.code ?? 'UNKNOWN'
    this.requestId = body?.error?.request_id ?? ''
    this.details = body?.error?.details
  }

  /** Field-level messages, for wiring straight into form helperText. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    if (!this.details) return out
    for (const [key, value] of Object.entries(this.details)) {
      if (Array.isArray(value) && typeof value[0] === 'string') {
        // API keys look like "product.variants"; forms use the leaf.
        out[key.replace(/^[a-z_]+\./, '')] = value[0]
      }
    }
    return out
  }
}

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

/** AuthProvider subscribes so a dead session redirects to /login exactly once. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

function notifyUnauthorized() {
  tokenStore.clear()
  unauthorizedListeners.forEach((l) => l())
}

/**
 * Refresh is deduplicated: if six queries all 401 at once we perform ONE
 * refresh and every caller awaits the same promise. Without this, five of the
 * six would replay an already-rotated refresh token, which the backend
 * (correctly) treats as theft and kills the whole session.
 */
let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.refresh
  if (!refresh) return false

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}${PREFIX}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
      if (!response.ok) return false
      const data = (await response.json()) as { access_token: string; refresh_token: string }
      tokenStore.set(data.access_token, data.refresh_token)
      return true
    } catch {
      return false
    } finally {
      // Clear on the next tick so concurrent callers all see the same promise.
      setTimeout(() => {
        refreshInFlight = null
      }, 0)
    }
  })()

  return refreshInFlight
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Another API root: the platform API (signup) lives beside the admin one. */
  prefix?: string
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
  /** Set an Idempotency-Key so a double-submitted create cannot duplicate. */
  idempotencyKey?: string
  skipAuth?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query'], prefix = PREFIX): string {
  const url = `${API_BASE}${prefix}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  if (!options.skipAuth) {
    const token = tokenStore.access
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(buildUrl(path, options.query, options.prefix), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (response.ok) return (await parseBody(response)) as T

  const body = (await parseBody(response)) as ApiErrorBody | null

  // A 15-minute access token expiring mid-session is normal, not an error the
  // user should ever see. Refresh once and replay the request.
  if (response.status === 401 && !isRetry && !options.skipAuth) {
    const code = body?.error?.code
    if (code === 'TOKEN_EXPIRED' || code === 'UNAUTHENTICATED') {
      const refreshed = await refreshAccessToken()
      if (refreshed) return request<T>(path, options, true)
    }
    notifyUnauthorized()
  }

  throw new ApiError(response.status, body)
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** Login must not send a stale Authorization header. */
  login: <T>(body: unknown) => request<T>('/auth/login', { method: 'POST', body, skipAuth: true }),
  /** Signed-out requests: forgot password, accept an invitation. */
  anonymous: <T>(method: string, path: string, body?: unknown) => request<T>(path, { method, body, skipAuth: true }),
}

/** The platform API (/platform/api/v1): store signup, and the operators' console. */
export const platformApi = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query, prefix: '/platform/api/v1' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body, prefix: '/platform/api/v1' }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body, prefix: '/platform/api/v1' }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body, prefix: '/platform/api/v1' }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE', prefix: '/platform/api/v1' }),
  /** Public: signup and its helpers need no session. */
  anonymousGet: <T>(path: string, query?: RequestOptions['query']) =>
    request<T>(path, { query, prefix: '/platform/api/v1', skipAuth: true }),
  anonymousPost: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body, prefix: '/platform/api/v1', skipAuth: true }),
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

/**
 * Multipart upload via XMLHttpRequest rather than fetch.
 *
 * fetch still has no upload-progress event, and a media picker that shows a
 * dead spinner while 20MB of pack shots crawl over a hotel wifi connection is
 * the difference between "slow" and "broken" to the person using it.
 */
export function uploadMedia(
  files: File[],
  options: { folderId?: number; altText?: string; onProgress?: (p: UploadProgress) => void } = {},
): Promise<{ media: import('./types').Media[]; count: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    if (options.folderId !== undefined) form.append('folder_id', String(options.folderId))
    if (options.altText) form.append('alt_text', options.altText)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl('/media'))

    const token = tokenStore.access
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      options.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      })
    })

    xhr.addEventListener('load', () => {
      let parsed: unknown = null
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        parsed = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as { media: import('./types').Media[]; count: number })
      } else {
        if (xhr.status === 401) notifyUnauthorized()
        reject(new ApiError(xhr.status, parsed as ApiErrorBody | null, 'Upload failed'))
      }
    })

    xhr.addEventListener('error', () => reject(new ApiError(0, null, 'Network error during upload')))
    xhr.addEventListener('abort', () => reject(new ApiError(0, null, 'Upload cancelled')))

    xhr.send(form)
  })
}
