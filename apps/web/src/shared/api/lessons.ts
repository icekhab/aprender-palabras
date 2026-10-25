import type {
  CreateLessonInput,
  LessonDetail,
  LessonListQuery,
  LessonListResponse,
  LessonWordItem,
  MoveLessonInput,
  RemoveLessonWordInput,
  RenameLessonInput,
  SetCurrentLessonInput,
  SetCurrentLessonPreview,
  TrainingReadiness,
  Word,
  WordDraft,
} from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export async function listLessons(
  query: LessonListQuery,
  signal?: AbortSignal,
): Promise<LessonListResponse> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  })

  return request<LessonListResponse>(`/api/lessons?${params}`, {
    method: 'GET',
    signal,
  })
}

export async function createLesson(
  input: CreateLessonInput,
): Promise<LessonDetail> {
  return request<LessonDetail>('/api/lessons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function getLesson(
  lessonId: string,
  signal?: AbortSignal,
): Promise<LessonDetail> {
  return request<LessonDetail>(`/api/lessons/${lessonId}`, {
    method: 'GET',
    signal,
  })
}

export async function renameLesson(
  lessonId: string,
  input: RenameLessonInput,
): Promise<LessonDetail> {
  return request<LessonDetail>(`/api/lessons/${lessonId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function moveLesson(
  lessonId: string,
  input: MoveLessonInput,
): Promise<LessonDetail> {
  return request<LessonDetail>(`/api/lessons/${lessonId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteLesson(lessonId: string): Promise<void> {
  await request(`/api/lessons/${lessonId}`, {
    method: 'DELETE',
  })
}

export async function previewSetCurrentLesson(
  input: SetCurrentLessonInput,
): Promise<SetCurrentLessonPreview> {
  return request<SetCurrentLessonPreview>('/api/lessons/current/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function setCurrentLesson(
  input: SetCurrentLessonInput,
): Promise<LessonDetail> {
  return request<LessonDetail>('/api/lessons/current', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function addExistingWordToLesson(
  lessonId: string,
  wordId: string,
): Promise<LessonWordItem> {
  return request<LessonWordItem>(`/api/lessons/${lessonId}/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordId }),
  })
}

export async function addNewWordToLesson(
  lessonId: string,
  draft: WordDraft,
): Promise<Word> {
  return request<Word>(`/api/lessons/${lessonId}/words/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
}

export async function removeWordFromLesson(
  lessonId: string,
  wordId: string,
  input: RemoveLessonWordInput = {},
): Promise<{ requiresDisposition: boolean }> {
  return request<{ requiresDisposition: boolean }>(
    `/api/lessons/${lessonId}/words/${wordId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export async function getLessonTrainingReadiness(
  lessonId: string,
  signal?: AbortSignal,
): Promise<TrainingReadiness> {
  return request<TrainingReadiness>(
    `/api/lessons/${lessonId}/training/readiness`,
    {
      method: 'GET',
      signal,
    },
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
