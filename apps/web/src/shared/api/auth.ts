import type { AuthUser, LoginInput } from '@aprender-palabras/contracts'

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly limit: number | null

  constructor(
    message: string,
    status: number,
    options?: { code?: string | null; limit?: number | null },
  ) {
    super(message)
    this.status = status
    this.code = options?.code ?? null
    this.limit = options?.limit ?? null
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let code: string | null = null
    let limit: number | null = null
    let message = `API returned ${response.status}`

    try {
      const body = (await response.json()) as {
        message?: unknown
        code?: unknown
        limit?: unknown
      }
      if (typeof body.message === 'string' && body.message.length > 0) {
        message = body.message
      }
      if (typeof body.code === 'string') {
        code = body.code
      }
      if (typeof body.limit === 'number' && Number.isFinite(body.limit)) {
        limit = body.limit
      }
    } catch {
      // Non-JSON error bodies are fine — keep status-only message.
    }

    return new ApiError(message, response.status, { code, limit })
  }
}

export function isGenerationQuotaError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 429 &&
    error.code === 'GENERATION_QUOTA_EXCEEDED'
  )
}

export function isSuggestionsQuotaError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 429 &&
    error.code === 'SUGGESTIONS_QUOTA_EXCEEDED'
  )
}

export async function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me')
}

export async function login(input: LoginInput): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', {
    method: 'POST',
  })
}

async function request<T = void>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw await ApiError.fromResponse(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
