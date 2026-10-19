import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { buildSessionQueue, chunkGroups, GROUP_SIZE } from './session-queue'

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
    // ids: intro:g0:cardId | ex1:g0:cardId
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
    // One group of 3: intros for uno+tres, then types 1–5 for all three words.
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

  it('follows bootstrap + round-robin for three groups', () => {
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

    // 5+5+2 words × 5 types
    expect(queue.filter((step) => step.kind === 'exercise')).toHaveLength(60)
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
})
