import type {
  AddExistingWordInput,
  DictionaryListItem,
  DictionaryListQuery,
  DictionaryListResponse,
  RegeneratedWordImage,
  RegenerateWordImageInput,
  UpdateWordCardInput,
  UserCardDetail,
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

  if (query.q) {
    params.set('q', query.q)
  }

  return request<DictionaryListResponse>(`/api/words?${params}`, {
    method: 'GET',
    signal,
  })
}

export async function getWordCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<UserCardDetail> {
  return request<UserCardDetail>(`/api/words/${cardId}`, {
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

export async function resetWordCardProgress(
  cardId: string,
): Promise<UserCardDetail> {
  return request<UserCardDetail>(`/api/words/${cardId}/reset-progress`, {
    method: 'POST',
  })
}

export async function updateWordCard(
  cardId: string,
  input: UpdateWordCardInput,
): Promise<UserCardDetail> {
  return request<UserCardDetail>(`/api/words/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export async function regenerateWordImage(
  input: RegenerateWordImageInput,
  signal?: AbortSignal,
): Promise<RegeneratedWordImage> {
  return request<RegeneratedWordImage>('/api/words/image/regenerate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal,
  })
}

export async function deleteWordCard(cardId: string): Promise<void> {
  await request<void>(`/api/words/${cardId}`, {
    method: 'DELETE',
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

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
