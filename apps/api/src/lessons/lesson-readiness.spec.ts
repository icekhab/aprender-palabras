import { describe, expect, it } from 'vitest'
import {
  getMissingTrainerFields,
  isWordReadyForTrainer,
} from './lesson-readiness.js'

describe('lesson readiness', () => {
  it('requires at least three distractors in each direction', () => {
    expect(
      isWordReadyForTrainer({
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
      }),
    ).toBe(true)

    expect(
      isWordReadyForTrainer({
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
        wrongSpanish: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
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
