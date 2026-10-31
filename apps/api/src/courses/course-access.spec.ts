import { describe, expect, it } from 'vitest'
import {
  isEffectivelyActive,
  isTeacherOrAdmin,
  normalizeLogin,
} from './course-access.js'

describe('course-access', () => {
  it('treats teacher and admin as course managers', () => {
    expect(isTeacherOrAdmin('teacher')).toBe(true)
    expect(isTeacherOrAdmin('admin')).toBe(true)
    expect(isTeacherOrAdmin('user')).toBe(false)
  })

  it('requires active flag and creator teacher/admin for effective activity', () => {
    expect(
      isEffectivelyActive({ active: true, creatorRole: 'teacher' }),
    ).toBe(true)
    expect(isEffectivelyActive({ active: true, creatorRole: 'user' })).toBe(
      false,
    )
    expect(
      isEffectivelyActive({ active: false, creatorRole: 'admin' }),
    ).toBe(false)
  })

  it('normalizes login for invite lookup', () => {
    expect(normalizeLogin('  User@Local.TEST ')).toBe('user@local.test')
  })
})
