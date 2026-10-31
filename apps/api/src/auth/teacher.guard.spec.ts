import { ForbiddenException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { TeacherGuard } from './teacher.guard.js'
import type { AuthenticatedRequest } from './auth.types.js'

function createContext(role: 'user' | 'teacher' | 'admin' | undefined) {
  const request = {
    authUser: role
      ? { id: 'user-1', login: 'a@b.c', role }
      : undefined,
  } as AuthenticatedRequest

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }
}

describe('TeacherGuard', () => {
  it('allows teacher and admin', () => {
    const guard = new TeacherGuard()
    expect(guard.canActivate(createContext('teacher') as never)).toBe(true)
    expect(guard.canActivate(createContext('admin') as never)).toBe(true)
  })

  it('rejects user role', () => {
    const guard = new TeacherGuard()
    expect(() => guard.canActivate(createContext('user') as never)).toThrow(
      ForbiddenException,
    )
  })
})
