import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import {
  buildSessionQueue,
  createRetryStep,
  INITIAL_UNLOCK,
  typesForWord,
  type ExerciseSessionStep,
} from './session-queue'

function word(
  overrides: Partial<TrainerSessionWord> &
    Pick<TrainerSessionWord, 'userCardId' | 'spanish' | 'russian'>,
): TrainerSessionWord {
  return {
    wordId: overrides.wordId ?? overrides.userCardId,
    completedTrainerCount: overrides.completedTrainerCount ?? 0,
    showIntro: overrides.showIntro ?? true,
    progress: 0,
    additionalTranslations: [],
    definitionEs: null,
    examples: [],
    partOfSpeech: null,
    gender: null,
    wrongRussian: ['a', 'b', 'c'],
    wrongSpanish: ['x', 'y', 'z'],
    imageUrl: null,
    imagePhotographerName: null,
    imagePhotographerUrl: null,
    imagePageUrl: null,
    imageProvider: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createRetryStep', () => {
  it('copies type and word with a unique retry id', () => {
    const step: ExerciseSessionStep = {
      kind: 'exercise',
      id: 'ex1:b0:card-1',
      type: 1,
      word: word({ userCardId: 'card-1', spanish: 'hola', russian: 'привет' }),
    }
    expect(createRetryStep(step, 1)).toEqual({
      kind: 'exercise',
      id: 'ex1:retry:1:card-1',
      type: 1,
      word: step.word,
    })
  })
})

describe('typesForWord', () => {
  it('keeps prefix 1/2 for the first two trainings (identity shuffle)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    expect(
      typesForWord(
        word({
          userCardId: '1',
          spanish: 'a',
          russian: 'а',
          completedTrainerCount: 0,
        }),
      ),
    ).toEqual([1, 2, 3, 4, 5])
    expect(
      typesForWord(
        word({
          userCardId: '2',
          spanish: 'b',
          russian: 'б',
          completedTrainerCount: 1,
        }),
      ),
    ).toEqual([1, 2, 3, 4, 5])
  })

  it('shuffles the 3/4/5 tail when random is not identity (early trainings)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(
      typesForWord(
        word({
          userCardId: '1',
          spanish: 'a',
          russian: 'а',
          completedTrainerCount: 0,
        }),
      ),
    ).toEqual([1, 2, 4, 5, 3])
  })

  it('fully shuffles 1/3/4/5 after two trainings and drops type 2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    expect(
      typesForWord(
        word({
          userCardId: '2',
          spanish: 'b',
          russian: 'б',
          completedTrainerCount: 2,
        }),
      ),
    ).toEqual([1, 3, 4, 5])
    expect(
      typesForWord(
        word({
          userCardId: '3',
          spanish: 'c',
          russian: 'в',
          completedTrainerCount: 3,
        }),
      ),
    ).toEqual([1, 3, 4, 5])
  })

  it('can put type 1 later when count >= 2 and shuffle is not identity', () => {
    // Fisher–Yates with random=0 on [1,3,4,5] → [3,4,5,1]
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(
      typesForWord(
        word({
          userCardId: '2',
          spanish: 'b',
          russian: 'б',
          completedTrainerCount: 2,
        }),
      ),
    ).toEqual([3, 4, 5, 1])
  })
})

describe('buildSessionQueue', () => {
  it('starts with an atomic unlock of the first four words: intros → 1 → 2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const words = Array.from({ length: 12 }, (_, i) =>
      word({
        userCardId: String(i + 1),
        spanish: `w${i + 1}`,
        russian: `р${i + 1}`,
        showIntro: true,
        completedTrainerCount: 0,
      }),
    )

    const queue = buildSessionQueue(words)
    const firstIds = words.slice(0, INITIAL_UNLOCK).map((item) => item.userCardId)

    // First 4 intros, then 4× type1, then 4× type2 — no later types or other words yet
    const head = queue.slice(0, 4 + 4 + 4)
    expect(head.every((step) => firstIds.includes(step.word.userCardId))).toBe(
      true,
    )
    expect(head.slice(0, 4).every((step) => step.kind === 'intro')).toBe(true)
    expect(
      head.slice(4, 8).every(
        (step) => step.kind === 'exercise' && step.type === 1,
      ),
    ).toBe(true)
    expect(
      head.slice(8, 12).every(
        (step) => step.kind === 'exercise' && step.type === 2,
      ),
    ).toBe(true)

    // Full session still covers every word’s chain
    expect(queue.filter((step) => step.kind === 'exercise')).toHaveLength(
      12 * 5,
    )
  })

  it('injects a batch as all intros then all type 1 before anything else for those words', () => {
    // random=0 → inject ASAP; inject size 2; tail shuffle [4,5,3]
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const words = Array.from({ length: 7 }, (_, i) =>
      word({
        userCardId: String(i + 1),
        spanish: `w${i + 1}`,
        russian: `р${i + 1}`,
        showIntro: true,
        completedTrainerCount: 0,
      }),
    )

    const queue = buildSessionQueue(words)

    // After initial 4 intros + 4×t1 + 4×t2, next is inject of 2
    const afterBoot = queue.slice(4 + 4 + 4)
    let i = 0
    while (afterBoot[i]?.kind === 'intro') {
      i += 1
    }
    const introBlock = afterBoot.slice(0, i)
    const batchIds = new Set(introBlock.map((step) => step.word.userCardId))
    expect(introBlock.length).toBe(2)
    expect(batchIds.size).toBe(2)

    const type1Block = []
    while (i < afterBoot.length) {
      const step = afterBoot[i]
      if (
        step?.kind !== 'exercise' ||
        step.type !== 1 ||
        !batchIds.has(step.word.userCardId)
      ) {
        break
      }
      type1Block.push(step)
      i += 1
    }

    expect(type1Block).toHaveLength(2)
    expect(
      afterBoot.slice(0, i).some(
        (step) =>
          step.kind === 'exercise' &&
          step.type !== 1 &&
          batchIds.has(step.word.userCardId),
      ),
    ).toBe(false)
  })

  it('skips type 2 in the initial block for ineligible words', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const words = [
      word({
        userCardId: '1',
        spanish: 'a',
        russian: 'а',
        showIntro: false,
        completedTrainerCount: 3,
      }),
      word({
        userCardId: '2',
        spanish: 'b',
        russian: 'б',
        showIntro: false,
        completedTrainerCount: 3,
      }),
      word({
        userCardId: '3',
        spanish: 'c',
        russian: 'в',
        showIntro: false,
        completedTrainerCount: 3,
      }),
      word({
        userCardId: '4',
        spanish: 'd',
        russian: 'г',
        showIntro: false,
        completedTrainerCount: 3,
      }),
    ]

    const queue = buildSessionQueue(words)
    const head = queue.slice(0, 4)
    expect(
      head.every((step) => step.kind === 'exercise' && step.type === 1),
    ).toBe(true)
    expect(queue.some((step) => step.kind === 'exercise' && step.type === 2)).toBe(
      false,
    )
    expect(queue.filter((step) => step.kind === 'exercise')).toHaveLength(16)
  })

  it('handles a single word session', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const queue = buildSessionQueue([
      word({
        userCardId: '1',
        spanish: 'a',
        russian: 'а',
        showIntro: false,
        completedTrainerCount: 1,
      }),
    ])

    expect(
      queue.map((step) =>
        step.kind === 'intro' ? 'intro' : `ex${step.type}`,
      ),
    ).toEqual(['ex1', 'ex2', 'ex3', 'ex4', 'ex5'])
  })
})
