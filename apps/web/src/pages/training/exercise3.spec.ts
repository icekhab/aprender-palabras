import { describe, expect, it } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { buildExercise3Step } from './exercise3'

function word(
  overrides: Partial<TrainerSessionWord> &
    Pick<TrainerSessionWord, 'userCardId' | 'spanish' | 'russian'>,
): TrainerSessionWord {
  return {
    wordId: 'word-1',
    completedTrainerCount: 0,
    showIntro: true,
    progress: 0,
    additionalTranslations: [],
    definitionEs: null,
    examples: [],
    partOfSpeech: null,
    gender: null,
    wrongRussian: ['a', 'b', 'c'],
    wrongSpanish: ['malo', 'peor', 'otro'],
    imageUrl: null,
    imagePhotographerName: null,
    imagePhotographerUrl: null,
    imagePageUrl: null,
    imageProvider: null,
    ...overrides,
  }
}

describe('buildExercise3Step', () => {
  it('builds four options including the correct spanish word', () => {
    const step = buildExercise3Step(
      word({
        userCardId: 'card-1',
        spanish: 'hola',
        russian: 'привет',
        wrongSpanish: ['adiós', 'gracias', 'por favor'],
      }),
    )

    expect(step.correctSpanish).toBe('hola')
    expect(step.russian).toBe('привет')
    expect(step.options).toHaveLength(4)
    expect(step.options).toEqual(
      expect.arrayContaining(['hola', 'adiós', 'gracias', 'por favor']),
    )
  })
})
