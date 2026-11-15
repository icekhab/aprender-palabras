import type { UserRole } from '@aprender-palabras/contracts'

export const DEFAULT_GENERATION_LIMIT: Record<
  Exclude<UserRole, 'admin'>,
  number
> = {
  user: 60,
  teacher: 100,
}

export const DEFAULT_SUGGESTIONS_LIMIT: Record<
  Exclude<UserRole, 'admin'>,
  number
> = {
  user: 450,
  teacher: 600,
}
