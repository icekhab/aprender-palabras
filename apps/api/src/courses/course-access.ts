import type { UserRole } from '@aprender-palabras/contracts'

export function isTeacherOrAdmin(role: UserRole): boolean {
  return role === 'teacher' || role === 'admin'
}

export function isEffectivelyActive(input: {
  active: boolean
  creatorRole: UserRole
}): boolean {
  return input.active && isTeacherOrAdmin(input.creatorRole)
}

export function normalizeLogin(login: string): string {
  return login.trim().toLocaleLowerCase()
}
