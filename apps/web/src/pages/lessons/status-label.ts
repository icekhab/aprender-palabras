import type { LessonStatus } from '@aprender-palabras/contracts'

export function lessonStatusLabel(status: LessonStatus): string {
  switch (status) {
    case 'previous':
      return 'Anterior'
    case 'current':
      return 'Actual'
    case 'next':
      return 'Siguiente'
    case 'future':
      return 'Futuro'
    case 'undefined':
      return 'Sin definir'
  }
}
