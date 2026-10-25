import { describe, expect, it } from 'vitest'
import { canEditWord } from './word-edit-access.js'

describe('canEditWord', () => {
  it('allows admin to edit any word', () => {
    expect(
      canEditWord('admin', 'user-1', {
        createdByUserId: 'other',
      }),
    ).toBe(true)
  })

  it('allows teacher to edit their own word', () => {
    expect(
      canEditWord('teacher', 'user-1', {
        createdByUserId: 'user-1',
      }),
    ).toBe(true)
  })

  it('denies teacher for another user word', () => {
    expect(
      canEditWord('teacher', 'user-2', {
        createdByUserId: 'user-1',
      }),
    ).toBe(false)
  })

  it('denies user for any word including own', () => {
    expect(
      canEditWord('user', 'user-1', {
        createdByUserId: 'user-1',
      }),
    ).toBe(false)
  })
})
