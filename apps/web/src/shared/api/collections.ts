import type {
  CreateCollectionTrainerResponse,
  CreateWordCollectionInput,
  SetWordCollectionStatusInput,
  UpdateWordCollectionInput,
  WordCollectionDetail,
  WordCollectionListResponse,
  WordDraft,
} from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export async function listCollections(
  q?: string,
  signal?: AbortSignal,
): Promise<WordCollectionListResponse> {
  const params = new URLSearchParams()
  if (q?.trim()) {
    params.set('q', q.trim())
  }
  const suffix = params.size > 0 ? `?${params}` : ''
  return request<WordCollectionListResponse>(`/api/collections${suffix}`, {
    method: 'GET',
    signal,
  })
}

export async function getCollection(
  collectionId: string,
  signal?: AbortSignal,
): Promise<WordCollectionDetail> {
  return request<WordCollectionDetail>(`/api/collections/${collectionId}`, {
    method: 'GET',
    signal,
  })
}

export async function createCollection(
  input: CreateWordCollectionInput,
): Promise<WordCollectionDetail> {
  return request<WordCollectionDetail>('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updateCollection(
  collectionId: string,
  input: UpdateWordCollectionInput,
): Promise<WordCollectionDetail> {
  return request<WordCollectionDetail>(`/api/collections/${collectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function setCollectionStatus(
  collectionId: string,
  input: SetWordCollectionStatusInput,
): Promise<WordCollectionDetail> {
  return request<WordCollectionDetail>(
    `/api/collections/${collectionId}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await request(`/api/collections/${collectionId}`, {
    method: 'DELETE',
  })
}

export async function addWordToCollection(
  collectionId: string,
  wordId: string,
): Promise<WordCollectionDetail> {
  return request<WordCollectionDetail>(
    `/api/collections/${collectionId}/words`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId }),
    },
  )
}

export async function addNewWordToCollection(
  collectionId: string,
  draft: WordDraft,
): Promise<WordCollectionDetail> {
  return request<WordCollectionDetail>(
    `/api/collections/${collectionId}/words/new`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    },
  )
}

export async function removeWordFromCollection(
  collectionId: string,
  wordId: string,
): Promise<void> {
  await request(`/api/collections/${collectionId}/words/${wordId}`, {
    method: 'DELETE',
  })
}

export async function addCollectionForUser(
  collectionId: string,
): Promise<WordCollectionDetail> {
  return request<WordCollectionDetail>(`/api/collections/${collectionId}/add`, {
    method: 'POST',
  })
}

export async function removeCollectionForUser(
  collectionId: string,
): Promise<void> {
  await request(`/api/collections/${collectionId}/add`, {
    method: 'DELETE',
  })
}

export async function createCollectionTrainer(
  collectionId: string,
): Promise<CreateCollectionTrainerResponse> {
  return request<CreateCollectionTrainerResponse>(
    `/api/collections/${collectionId}/trainers`,
    { method: 'POST' },
  )
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
    throw await ApiError.fromResponse(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
