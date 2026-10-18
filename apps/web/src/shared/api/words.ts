import type {
  AddExistingWordInput,
  DictionaryListItem,
  DictionaryListQuery,
  DictionaryListResponse,
  Word,
  WordDraft,
  WordPairInput,
} from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export async function listDictionaryWords(
  query: DictionaryListQuery,
  signal?: AbortSignal,
): Promise<DictionaryListResponse> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  })

  return request<DictionaryListResponse>(`/api/words?${params}`, {
    method: 'GET',
    signal,
  })
}

export async function previewWord(
  input: WordPairInput,
  signal?: AbortSignal,
): Promise<WordDraft> {
  return request<WordDraft>('/api/words/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal,
  })
}

export async function createWord(draft: WordDraft): Promise<Word> {
  return request<Word>('/api/words', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draft),
  })
}

export async function addExistingWord(
  input: AddExistingWordInput,
): Promise<DictionaryListItem> {
  return request<DictionaryListItem>('/api/words/existing', {
    method: 'POST',
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
    throw new ApiError(`API returned ${response.status}`, response.status)
  }

  return response.json() as Promise<T>
}
