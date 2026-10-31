import type { CourseListView } from '@aprender-palabras/contracts'

/** Prefix used to invalidate all course list views. */
export const COURSES_QUERY_KEY = ['courses', 'list'] as const

export function coursesListQueryKey(view: CourseListView) {
  return ['courses', 'list', view] as const
}

export const courseQueryKey = (courseId: string) =>
  ['courses', 'detail', courseId] as const

export const courseLessonsQueryKey = (courseId: string) =>
  ['courses', courseId, 'lessons'] as const

export const courseMembersQueryKey = (courseId: string) =>
  ['courses', courseId, 'members'] as const

export const invitedUsersQueryKey = ['courses', 'invited-users'] as const

export const invitedUserQueryKey = (userId: string) =>
  ['courses', 'invited-users', userId] as const
