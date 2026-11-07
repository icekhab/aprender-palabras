import { describe, expect, it } from 'vitest'
import {
  normalizeEnabledExerciseTypes,
  updatePreferencesSchema,
} from '@aprender-palabras/contracts'

describe('normalizeEnabledExerciseTypes', () => {
  it('returns the default set for invalid input', () => {
    expect(normalizeEnabledExerciseTypes(null)).toEqual([1, 3, 4, 5])
    expect(normalizeEnabledExerciseTypes([1])).toEqual([1, 3, 4, 5])
  })

  it('keeps a valid subset sorted in canonical order', () => {
    expect(normalizeEnabledExerciseTypes([5, 1, 3, 1])).toEqual([1, 3, 5])
  })
})

describe('updatePreferencesSchema', () => {
  it('accepts at least two unique configurable types', () => {
    expect(
      updatePreferencesSchema.parse({
        enabledExerciseTypes: [5, 1],
      }),
    ).toEqual({ enabledExerciseTypes: [1, 5] })
  })

  it('rejects fewer than two enabled types', () => {
    expect(
      updatePreferencesSchema.safeParse({
        enabledExerciseTypes: [1],
      }).success,
    ).toBe(false)
  })

  it('rejects type 2 and unknown types', () => {
    expect(
      updatePreferencesSchema.safeParse({
        enabledExerciseTypes: [1, 2, 3],
      }).success,
    ).toBe(false)
  })
})
