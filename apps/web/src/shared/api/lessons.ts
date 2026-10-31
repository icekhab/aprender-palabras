import type {
  CreateLessonInput,
  LessonDetail,
  LessonListQuery,
  LessonListResponse,
  LessonWordItem,
  MoveLessonInput,
  RemoveLessonWordInput,
  RenameLessonInput,
  TrainingReadiness,
  Word,
  WordDraft,
} from '@aprender-palabras/contracts'
import { ApiError } from './auth'

function lessonsBase(courseId: string): string {
  return `/api/courses/${courseId}/lessons`
}

export async function listLessons(
  courseId: string,
  query: LessonListQuery,
  signal?: AbortSignal,
): Promise<LessonListResponse> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  })

  return request<LessonListResponse>(`${lessonsBase(courseId)}?${params}`, {
    method: 'GET',
    signal,
  })
}

export async function createLesson(
  courseId: string,
  input: CreateLessonInput,
): Promise<LessonDetail> {
  return request<LessonDetail>(lessonsBase(courseId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function getLesson(
  courseId: string,
  lessonId: string,
  signal?: AbortSignal,
): Promise<LessonDetail> {
  return request<LessonDetail>(`${lessonsBase(courseId)}/${lessonId}`, {
    method: 'GET',
    signal,
  })
}

export async function renameLesson(
  courseId: string,
  lessonId: string,
  input: RenameLessonInput,
): Promise<LessonDetail> {
  return request<LessonDetail>(`${lessonsBase(courseId)}/${lessonId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function moveLesson(
  courseId: string,
  lessonId: string,
  input: MoveLessonInput,
): Promise<LessonDetail> {
  return request<LessonDetail>(`${lessonsBase(courseId)}/${lessonId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteLesson(
  courseId: string,
  lessonId: string,
): Promise<void> {
  await request(`${lessonsBase(courseId)}/${lessonId}`, {
    method: 'DELETE',
  })
}

export async function addExistingWordToLesson(
  courseId: string,
  lessonId: string,
  wordId: string,
): Promise<LessonWordItem> {
  return request<LessonWordItem>(
    `${lessonsBase(courseId)}/${lessonId}/words`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId }),
    },
  )
}

export async function addNewWordToLesson(
  courseId: string,
  lessonId: string,
  draft: WordDraft,
): Promise<Word> {
  return request<Word>(`${lessonsBase(courseId)}/${lessonId}/words/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
}

export async function removeWordFromLesson(
  courseId: string,
  lessonId: string,
  wordId: string,
  input: RemoveLessonWordInput = {},
): Promise<{ requiresDisposition: boolean }> {
  return request<{ requiresDisposition: boolean }>(
    `${lessonsBase(courseId)}/${lessonId}/words/${wordId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export async function getLessonTrainingReadiness(
  courseId: string,
  lessonId: string,
  signal?: AbortSignal,
): Promise<TrainingReadiness> {
  return request<TrainingReadiness>(
    `${lessonsBase(courseId)}/${lessonId}/training/readiness`,
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
