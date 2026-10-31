import type {
  CourseDetail,
  CourseListResponse,
  CourseListView,
  CourseMemberItem,
  CreateCourseInput,
  InvitedUserDetail,
  InvitedUserItem,
  SetCurrentLessonPreview,
  UpdateCourseInput,
} from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export async function listCourses(
  view: CourseListView = 'student',
  signal?: AbortSignal,
): Promise<CourseListResponse> {
  const params = new URLSearchParams({ view })
  return request<CourseListResponse>(`/api/courses?${params}`, {
    method: 'GET',
    signal,
  })
}

export async function createCourse(
  input: CreateCourseInput,
): Promise<CourseDetail> {
  return request<CourseDetail>('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function getCourse(
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseDetail> {
  return request<CourseDetail>(`/api/courses/${courseId}`, {
    method: 'GET',
    signal,
  })
}

export async function updateCourse(
  courseId: string,
  input: UpdateCourseInput,
): Promise<CourseDetail> {
  return request<CourseDetail>(`/api/courses/${courseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function inviteToCourse(
  courseId: string,
  login: string,
): Promise<CourseMemberItem> {
  return request<CourseMemberItem>(`/api/courses/${courseId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login }),
  })
}

export async function acceptCourse(courseId: string): Promise<CourseDetail> {
  return request<CourseDetail>(`/api/courses/${courseId}/accept`, {
    method: 'POST',
  })
}

export async function rejectCourse(courseId: string): Promise<void> {
  await request(`/api/courses/${courseId}/reject`, {
    method: 'POST',
  })
}

export async function listCourseMembers(
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseMemberItem[]> {
  return request<CourseMemberItem[]>(`/api/courses/${courseId}/members`, {
    method: 'GET',
    signal,
  })
}

export async function removeCourseMember(
  courseId: string,
  userId: string,
): Promise<void> {
  await request(`/api/courses/${courseId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export async function previewMemberCurrentLesson(
  courseId: string,
  userId: string,
  lessonId: string,
): Promise<SetCurrentLessonPreview> {
  return request<SetCurrentLessonPreview>(
    `/api/courses/${courseId}/members/${userId}/current-lesson/preview`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
    },
  )
}

export async function setMemberCurrentLesson(
  courseId: string,
  userId: string,
  lessonId: string,
): Promise<CourseMemberItem> {
  return request<CourseMemberItem>(
    `/api/courses/${courseId}/members/${userId}/current-lesson`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
    },
  )
}

export async function listInvitedUsers(
  signal?: AbortSignal,
): Promise<InvitedUserItem[]> {
  return request<InvitedUserItem[]>('/api/courses/invited-users', {
    method: 'GET',
    signal,
  })
}

export async function getInvitedUserDetail(
  userId: string,
  signal?: AbortSignal,
): Promise<InvitedUserDetail> {
  return request<InvitedUserDetail>(`/api/courses/invited-users/${userId}`, {
    method: 'GET',
    signal,
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
    throw await ApiError.fromResponse(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
