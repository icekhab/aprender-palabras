import { describe, expect, it } from 'vitest'
import {
  MAX_TRAINER_WORDS,
  buildDailyTrainers,
  buildExtraTrainer,
  madridDateString,
  pickExtraTrainerWords,
  resolveAnchor,
  type SelectionCard,
} from './selection.js'

function card(
  overrides: Partial<SelectionCard> & Pick<SelectionCard, 'userCardId'>,
): SelectionCard {
  return {
    wordId: overrides.wordId ?? overrides.userCardId,
    progress: 0,
    lastTrainedAt: null,
    completedTrainerCount: 0,
    showCount: 0,
    addedAt: new Date('2026-10-01T12:00:00.000Z'),
    source: 'manual',
    lessonPositions: [],
    ...overrides,
  }
}

function fixedRandom(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length] ?? 0
    index += 1
    return value
  }
}

describe('madridDateString', () => {
  it('formats a UTC instant in Europe/Madrid calendar date', () => {
    expect(madridDateString(new Date('2026-10-18T23:30:00.000Z'))).toBe(
      '2026-10-19',
    )
  })
})

describe('resolveAnchor', () => {
  it('uses lastCompletedTrainerAt when present', () => {
    const last = new Date('2026-09-01T12:00:00.000Z')
    const now = new Date('2026-10-19T12:00:00.000Z')
    expect(resolveAnchor(last, now)).toBe(last)
  })

  it('falls back to now when never trained', () => {
    const now = new Date('2026-10-19T12:00:00.000Z')
    expect(resolveAnchor(null, now)).toBe(now)
  })
})

describe('buildDailyTrainers with current lesson', () => {
  const now = new Date('2026-10-19T12:00:00.000Z')
  const anchor = now

  it('puts unstarted only in slot 6, including current-lesson words', () => {
    const cards = [
      card({
        userCardId: 'l0-new',
        source: 'lesson',
        lessonPositions: [2],
        completedTrainerCount: 0,
        addedAt: new Date('2026-10-18T12:00:00.000Z'),
      }),
      card({
        userCardId: 'l0-old',
        source: 'lesson',
        lessonPositions: [2],
        completedTrainerCount: 1,
        lastTrainedAt: new Date('2026-10-10T12:00:00.000Z'),
        progress: 50,
        addedAt: new Date('2026-09-01T12:00:00.000Z'),
      }),
    ]

    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: 2,
      anchor,
      now,
      random: () => 0.2,
    })

    const slot1 = trainers.find((item) => item.slot === 1)
    const slot6 = trainers.find((item) => item.slot === 6)
    expect(slot1?.sourceLabel).toBe('Lección actual')
    expect(slot1?.userCardIds).toEqual(['l0-old'])
    expect(slot1?.userCardIds).not.toContain('l0-new')
    expect(slot6?.userCardIds).toContain('l0-new')
  })

  it('does not repeat words across the two Lección actual slots', () => {
    const cards = Array.from({ length: 20 }, (_, index) =>
      card({
        userCardId: `s${index}`,
        source: 'lesson',
        lessonPositions: [3],
        completedTrainerCount: 1,
        lastTrainedAt: new Date('2026-10-05T12:00:00.000Z'),
        progress: index,
        addedAt: new Date('2026-09-01T12:00:00.000Z'),
      }),
    )

    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: 3,
      anchor,
      now,
      random: () => 0.2,
    })

    const a = trainers.find((item) => item.slot === 1)?.userCardIds ?? []
    const b = trainers.find((item) => item.slot === 2)?.userCardIds ?? []
    expect(a).toHaveLength(MAX_TRAINER_WORDS)
    expect(b).toHaveLength(5)
    expect(a.some((id) => b.includes(id))).toBe(false)
  })

  it('skips Lecciones recientes when there are no started previous-lesson or young cards', () => {
    const cards = [
      card({
        userCardId: 'current',
        source: 'lesson',
        lessonPositions: [1],
        completedTrainerCount: 1,
        lastTrainedAt: new Date('2026-10-10T12:00:00.000Z'),
        addedAt: new Date('2026-01-01T12:00:00.000Z'),
      }),
      card({
        userCardId: 'new',
        completedTrainerCount: 0,
        addedAt: new Date('2026-10-18T12:00:00.000Z'),
      }),
    ]

    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: 1,
      anchor,
      now,
      random: () => 0.2,
    })

    expect(
      trainers.some((item) => item.sourceLabel === 'Lecciones recientes'),
    ).toBe(false)
  })

  it('skips Repaso lejano when no started card is age >= 28 from anchor', () => {
    const cards = [
      card({
        userCardId: 'young-started',
        completedTrainerCount: 1,
        lastTrainedAt: new Date('2026-10-10T12:00:00.000Z'),
        addedAt: new Date('2026-10-01T12:00:00.000Z'),
        lessonPositions: [2],
        source: 'lesson',
      }),
    ]

    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: 2,
      anchor,
      now,
      random: () => 0.2,
    })

    expect(trainers.some((item) => item.sourceLabel === 'Repaso lejano')).toBe(
      false,
    )
  })

  it('skips Palabras ya estudiadas when last training is recent vs anchor', () => {
    const cards = [
      card({
        userCardId: 'recently-trained',
        completedTrainerCount: 2,
        lastTrainedAt: new Date('2026-10-10T12:00:00.000Z'),
        addedAt: new Date('2026-01-01T12:00:00.000Z'),
        lessonPositions: [1],
        source: 'lesson',
      }),
    ]

    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: 1,
      anchor,
      now,
      random: () => 0.2,
    })

    expect(
      trainers.some((item) => item.sourceLabel === 'Palabras ya estudiadas'),
    ).toBe(false)
  })

  it('keeps age windows relative to frozen anchor after a long absence', () => {
    const anchorFrozen = new Date('2026-09-01T12:00:00.000Z')
    const nowLater = new Date('2026-10-19T12:00:00.000Z')
    const cards = [
      card({
        userCardId: 'was-recent-at-anchor',
        source: 'manual',
        completedTrainerCount: 1,
        lastTrainedAt: new Date('2026-08-20T12:00:00.000Z'),
        // 10 days before frozen anchor → Recent-14 vs anchor
        addedAt: new Date('2026-08-22T12:00:00.000Z'),
      }),
    ]

    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: 1,
      anchor: anchorFrozen,
      now: nowLater,
      random: () => 0.2,
    })

    const slot1 = trainers.find((item) => item.slot === 1)
    expect(slot1?.userCardIds).toContain('was-recent-at-anchor')
  })

  it('does not create Nuevas slot when there are no unstarted cards', () => {
    const cards = [
      card({
        userCardId: 'only-started',
        source: 'lesson',
        lessonPositions: [1],
        completedTrainerCount: 1,
        lastTrainedAt: new Date('2026-10-01T12:00:00.000Z'),
        addedAt: new Date('2026-09-01T12:00:00.000Z'),
      }),
    ]

    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: 1,
      anchor,
      now,
      random: () => 0.2,
    })

    expect(
      trainers.some((item) => item.sourceLabel === 'Nuevas y próxima lección'),
    ).toBe(false)
  })
})

describe('buildDailyTrainers without current lesson', () => {
  it('creates fewer trainers when there are few ready cards', () => {
    const cards = [
      card({
        userCardId: 'a',
        addedAt: new Date(),
        completedTrainerCount: 0,
      }),
    ]
    const trainers = buildDailyTrainers({
      cards,
      currentLessonPosition: null,
      now: new Date('2026-10-19T12:00:00.000Z'),
      random: () => 0.1,
    })

    expect(trainers).toHaveLength(1)
    expect(trainers[0]?.sourceLabel).toBe('Palabras nuevas')
    expect(trainers[0]?.userCardIds).toEqual(['a'])
  })
})

describe('extra trainer', () => {
  it('builds an extra trainer with soft weights', () => {
    const cards = [
      card({ userCardId: 'low', progress: 0 }),
      card({ userCardId: 'high', progress: 100 }),
    ]
    const usedToday = new Set<string>(['low'])
    const picked = pickExtraTrainerWords(cards, usedToday, fixedRandom([0.99]))
    expect(picked.length).toBe(2)
  })

  it('returns null when there are no cards', () => {
    expect(
      buildExtraTrainer({
        cards: [],
        usedToday: new Set(),
      }),
    ).toBeNull()
  })
})
