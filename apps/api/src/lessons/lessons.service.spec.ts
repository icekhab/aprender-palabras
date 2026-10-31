import { describe, expect, it } from 'vitest'
import { isWordReadyForTrainer } from './lesson-readiness.js'

describe('LessonsService helpers', () => {
  it('keeps readiness helper available for course-scoped lessons', () => {
    expect(
      isWordReadyForTrainer({
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
      }),
    ).toBe(true)
  })
})
