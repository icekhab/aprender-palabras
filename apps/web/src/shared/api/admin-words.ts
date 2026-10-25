import type {
  AdminWordDetail,
  AdminWordsListQuery,
  AdminWordsListResponse,
  UpdateWordCardInput,
  WordDraft,
} from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export class AdminConflictError extends ApiError {
  readonly wordId: string | null

  constructor(status: number, wordId: string | null) {
    super(`API returned ${status}`, status)
    this.wordId = wordId
  }
}

export async function listAdminWords(
  query: AdminWordsListQuery,
  signal?: AbortSignal,
): Promise<AdminWordsListResponse> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
    sortBy: query.sortBy,
  })

  if (query.q) {
    params.set('q', query.q)
  }

  return request<AdminWordsListResponse>(`/api/admin/words?${params}`, {
    method: 'GET',
    signal,
  })
}

export async function getAdminWord(
  wordId: string,
  signal?: AbortSignal,
): Promise<AdminWordDetail> {
  return request<AdminWordDetail>(`/api/admin/words/${wordId}`, {
    method: 'GET',
    signal,
  })
}

export async function createAdminWord(
  draft: WordDraft,
): Promise<AdminWordDetail> {
  return request<AdminWordDetail>('/api/admin/words', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draft),
  })
}

export async function updateAdminWord(
  wordId: string,
  input: UpdateWordCardInput,
): Promise<AdminWordDetail> {
  return request<AdminWordDetail>(`/api/admin/words/${wordId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    if (response.status === 409) {
      let wordId: string | null = null
      try {
        const body = (await response.json()) as {
          wordId?: string
          message?: { wordId?: string } | string
        }
        if (typeof body.wordId === 'string') {
          wordId = body.wordId
        } else if (
          body.message &&
          typeof body.message === 'object' &&
          typeof body.message.wordId === 'string'
        ) {
          wordId = body.message.wordId
        }
      } catch {
        wordId = null
      }

      throw new AdminConflictError(409, wordId)
    }

    throw await ApiError.fromResponse(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
