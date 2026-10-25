import { ForbiddenException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AdminGuard } from './admin.guard.js'
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

describe('AdminGuard', () => {
  it('allows admin', () => {
    const guard = new AdminGuard()
    expect(guard.canActivate(createContext('admin') as never)).toBe(true)
  })

  it('rejects non-admin roles', () => {
    const guard = new AdminGuard()
    expect(() => guard.canActivate(createContext('user') as never)).toThrow(
      ForbiddenException,
    )
    expect(() =>
      guard.canActivate(createContext('teacher') as never),
    ).toThrow(ForbiddenException)
  })
})
