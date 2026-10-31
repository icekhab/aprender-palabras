import type { LessonStatus } from '@aprender-palabras/contracts'

/** UI shows only the current-lesson mark; other statuses stay silent. */
export function lessonStatusLabel(status: LessonStatus): string | null {
  return status === 'current' ? 'Actual' : null
}
