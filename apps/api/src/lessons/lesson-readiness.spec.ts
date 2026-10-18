import { describe, expect, it } from 'vitest'
import {
  getMissingTrainerFields,
  isWordReadyForTrainer,
} from './lesson-readiness.js'

describe('lesson readiness', () => {
  it('requires three distractors in each direction', () => {
    expect(
      isWordReadyForTrainer({
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
      }),
    ).toBe(true)

    expect(
      getMissingTrainerFields({
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['a', 'b'],
        wrongSpanish: ['x', 'y', 'z'],
      }),
    ).toEqual(['wrongRussian'])
  })
})
