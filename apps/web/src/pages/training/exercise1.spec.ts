import { describe, expect, it } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { buildExercise1Step } from './exercise1'

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
    wrongRussian: ['ошибка1', 'ошибка2', 'ошибка3'],
    wrongSpanish: ['x', 'y', 'z'],
    imageUrl: null,
    imagePhotographerName: null,
    imagePhotographerUrl: null,
    imagePageUrl: null,
    imageProvider: null,
    ...overrides,
  }
}

describe('buildExercise1Step', () => {
  it('builds four options including the correct russian translation', () => {
    const step = buildExercise1Step(
      word({
        userCardId: 'card-1',
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
      }),
    )

    expect(step.correctRussian).toBe('привет')
    expect(step.options).toHaveLength(4)
    expect(step.options).toEqual(
      expect.arrayContaining(['привет', 'пока', 'спасибо', 'пожалуйста']),
    )
  })
})
