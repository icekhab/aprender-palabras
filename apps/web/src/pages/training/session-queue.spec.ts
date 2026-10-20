import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import {
  buildSessionQueue,
  chunkGroups,
  GROUP_SIZE,
  typesForWord,
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

/** With Math.random ≈ 1, shuffleInPlace is identity — group membership is stable. */
function blockSignature(
  queue: ReturnType<typeof buildSessionQueue>,
): string[] {
  const signatures: string[] = []
  let current: string | null = null

  for (const step of queue) {
    // ids: intro:g0:cardId | ex1:g0:r0:cardId
    const groupPart = step.id.split(':')[1]!
    const key =
      step.kind === 'intro' ? `intro:${groupPart}` : `ex${step.type}:${groupPart}`
    if (key !== current) {
      signatures.push(key)
      current = key
    }
  }

  return signatures
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('chunkGroups', () => {
  it('splits into groups of at most five with a small tail', () => {
    const items = Array.from({ length: 12 }, (_, i) => i + 1)
    expect(chunkGroups(items, GROUP_SIZE)).toEqual([
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12],
    ])
  })
})

describe('typesForWord', () => {
  it('keeps prefix 1/2 and includes each of 3/4/5 once (identity shuffle)', () => {
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
          completedTrainerCount: 2,
        }),
      ),
    ).toEqual([1, 2, 3, 4, 5])
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

  it('shuffles the 3/4/5 tail when random is not identity', () => {
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
    expect(
      typesForWord(
        word({
          userCardId: '2',
          spanish: 'b',
          russian: 'б',
          completedTrainerCount: 3,
        }),
      ),
    ).toEqual([1, 4, 5, 3])
  })
})

describe('buildSessionQueue', () => {
  it('places each group intro just before that group’s first exercise', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const words = [
      word({
        userCardId: '1',
        spanish: 'uno',
        russian: 'один',
        showIntro: true,
      }),
      word({
        userCardId: '2',
        spanish: 'dos',
        russian: 'два',
        showIntro: false,
        completedTrainerCount: 2,
      }),
      word({
        userCardId: '3',
        spanish: 'tres',
        russian: 'три',
        showIntro: true,
      }),
    ]

    const queue = buildSessionQueue(words)
    expect(queue.filter((step) => step.kind === 'intro')).toEqual([
      expect.objectContaining({
        kind: 'intro',
        word: expect.objectContaining({ spanish: 'uno' }),
      }),
      expect.objectContaining({
        kind: 'intro',
        word: expect.objectContaining({ spanish: 'tres' }),
      }),
    ])

    const firstExerciseIndex = queue.findIndex((step) => step.kind === 'exercise')
    expect(firstExerciseIndex).toBe(2)
    expect(queue[firstExerciseIndex]).toEqual(
      expect.objectContaining({ kind: 'exercise', type: 1 }),
    )

    expect(queue.filter((step) => step.kind === 'exercise')).toHaveLength(15)
  })

  it('follows bootstrap + round-robin for three groups when all get type 2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const words = Array.from({ length: 12 }, (_, i) =>
      word({
        userCardId: String(i + 1),
        spanish: `w${i + 1}`,
        russian: `р${i + 1}`,
        showIntro: false,
        completedTrainerCount: 1,
      }),
    )

    const queue = buildSessionQueue(words)
    expect(blockSignature(queue)).toEqual([
      'ex1:g0',
      'ex2:g0',
      'ex1:g1',
      'ex3:g0',
      'ex1:g2',
      'ex2:g1',
      'ex4:g0',
      'ex2:g2',
      'ex3:g1',
      'ex5:g0',
      'ex3:g2',
      'ex4:g1',
      'ex4:g2',
      'ex5:g1',
      'ex5:g2',
    ])

    expect(queue.filter((step) => step.kind === 'exercise')).toHaveLength(60)
  })

  it('mixes type 2 and type 3 in the same group round for mixed eligibility', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const words = [
      word({
        userCardId: '1',
        spanish: 'w1',
        russian: 'р1',
        showIntro: false,
        completedTrainerCount: 0,
      }),
      word({
        userCardId: '2',
        spanish: 'w2',
        russian: 'р2',
        showIntro: false,
        completedTrainerCount: 1,
      }),
      word({
        userCardId: '3',
        spanish: 'w3',
        russian: 'р3',
        showIntro: false,
        completedTrainerCount: 3,
      }),
      word({
        userCardId: '4',
        spanish: 'w4',
        russian: 'р4',
        showIntro: false,
        completedTrainerCount: 5,
      }),
      word({
        userCardId: '5',
        spanish: 'w5',
        russian: 'р5',
        showIntro: false,
        completedTrainerCount: 2,
      }),
    ]

    const queue = buildSessionQueue(words)
    const exercises = queue.filter((step) => step.kind === 'exercise')

    // round 0: five type-1; round 1: mix 2 and 3
    const round2 = exercises.slice(5, 10)
    expect(round2.map((step) => step.type).sort()).toEqual([2, 2, 2, 3, 3])
    expect(
      round2
        .filter((step) => step.type === 2)
        .map((step) => step.word.spanish)
        .sort(),
    ).toEqual(['w1', 'w2', 'w5'])
    expect(
      round2
        .filter((step) => step.type === 3)
        .map((step) => step.word.spanish)
        .sort(),
    ).toEqual(['w3', 'w4'])

    // ineligible never get type 2
    expect(
      exercises.filter(
        (step) =>
          step.type === 2 &&
          (step.word.spanish === 'w3' || step.word.spanish === 'w4'),
      ),
    ).toHaveLength(0)

    // 3 eligible × 5 + 2 ineligible × 4
    expect(exercises).toHaveLength(3 * 5 + 2 * 4)
  })

  it('bootstraps a single group as intro then types 1–5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const words = [
      word({ userCardId: '1', spanish: 'a', russian: 'а', showIntro: true }),
      word({ userCardId: '2', spanish: 'b', russian: 'б', showIntro: false }),
    ]

    expect(blockSignature(buildSessionQueue(words))).toEqual([
      'intro:g0',
      'ex1:g0',
      'ex2:g0',
      'ex3:g0',
      'ex4:g0',
      'ex5:g0',
    ])
  })

  it('skips intros when no word needs them', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const words = [
      word({
        userCardId: '1',
        spanish: 'a',
        russian: 'а',
        showIntro: false,
        completedTrainerCount: 2,
      }),
    ]

    const queue = buildSessionQueue(words)
    expect(queue.every((step) => step.kind === 'exercise')).toBe(true)
    expect(queue[0]).toEqual(
      expect.objectContaining({ kind: 'exercise', type: 1 }),
    )
  })

  it('keeps a stable per-word 3/4/5 permutation across rounds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const queue = buildSessionQueue([
      word({
        userCardId: '1',
        spanish: 'a',
        russian: 'а',
        showIntro: false,
        completedTrainerCount: 1,
      }),
    ])

    const types = queue
      .filter((step) => step.kind === 'exercise')
      .map((step) => step.type)

    expect(types).toEqual([1, 2, 4, 5, 3])
    expect(types.filter((type) => type === 3)).toHaveLength(1)
    expect(types.filter((type) => type === 4)).toHaveLength(1)
    expect(types.filter((type) => type === 5)).toHaveLength(1)
  })
})
