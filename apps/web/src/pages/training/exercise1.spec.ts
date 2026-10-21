import { describe, expect, it } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { buildExercise1Step, pickRandomItems } from './exercise1'

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

describe('pickRandomItems', () => {
  it('returns at most count items from the pool', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const picked = pickRandomItems(pool, 3)

    expect(picked).toHaveLength(3)
    for (const item of picked) {
      expect(pool).toContain(item)
    }
  })
})

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

  it('picks three distractors from a larger wrongRussian pool', () => {
    const wrongRussian = [
      'пока',
      'спасибо',
      'пожалуйста',
      'утро',
      'вечер',
      'ночь',
      'день',
      'неделя',
      'месяц',
      'год',
    ]
    const step = buildExercise1Step(
      word({
        userCardId: 'card-1',
        spanish: 'hola',
        russian: 'привет',
        wrongRussian,
      }),
    )

    expect(step.options).toHaveLength(4)
    expect(step.options).toContain('привет')
    const distractors = step.options.filter((option) => option !== 'привет')
    expect(distractors).toHaveLength(3)
    for (const item of distractors) {
      expect(wrongRussian).toContain(item)
    }
  })
})
