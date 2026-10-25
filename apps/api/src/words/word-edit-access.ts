import type { UserRole } from '@aprender-palabras/contracts'

export function canEditWord(
  role: UserRole,
  userId: string,
  word: {
    createdByUserId: string | null
  },
): boolean {
  if (role === 'admin') {
    return true
  }

  if (role === 'teacher') {
    return (
      word.createdByUserId !== null && word.createdByUserId === userId
    )
  }

  return false
}
