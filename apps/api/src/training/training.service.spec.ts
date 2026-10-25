import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingService } from './training.service.js'

function createPrismaMock() {
  const tx = {
    userCard: {
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainer: {
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    user: {
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  return {
    $transaction: vi.fn<
      (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
    >(async (callback) => callback(tx)),
    _tx: tx,
    dailyTrainingDay: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainer: {
      findFirst: vi.fn<(args: unknown) => Promise<unknown>>(),
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      count: vi.fn<(args: unknown) => Promise<number>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainerWord: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    },
    user: {
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCard: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      count: vi.fn<(args: unknown) => Promise<number>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    lesson: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    },
  }
}

function sessionWord(
  overrides: {
    id?: string
    progress?: number
    spanish?: string
    russian?: string
  } = {},
) {
  return {
    userCard: {
      id: overrides.id ?? 'card-1',
      wordId: 'word-1',
      progress: overrides.progress ?? 40,
      completedTrainerCount: 1,
      word: {
        spanish: overrides.spanish ?? 'hola',
        russian: overrides.russian ?? 'привет',
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
      },
    },
  }
}

describe('TrainingService.getToday', () => {
  const prisma = createPrismaMock()

  let service: TrainingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TrainingService(prisma as never)
  })

  it('returns an existing day without regenerating trainers', async () => {
    prisma.dailyTrainingDay.findUnique.mockResolvedValue({
      id: 'day-1',
      trainers: [
        {
          id: 't1',
          kind: 'daily',
          slot: 1,
          status: 'not_started',
          sourceLabel: 'Palabras nuevas',
          words: [
            {
              userCard: {
                id: 'card-1',
                wordId: 'word-1',
                progress: 0,
                word: { spanish: 'hola', russian: 'привет' },
              },
            },
          ],
        },
      ],
    })
    prisma.userCard.findMany.mockResolvedValue([
      {
        word: {
          spanish: 'hola',
          russian: 'привет',
          wrongRussian: ['a', 'b', 'c'],
          wrongSpanish: ['x', 'y', 'z'],
        },
      },
    ])

    const result = await service.getToday('user-1')

    expect(prisma.dailyTrainingDay.create).not.toHaveBeenCalled()
    expect(result.trainers).toHaveLength(1)
    expect(result.trainers[0]?.words[0]?.spanish).toBe('hola')
    expect(result.readyCardCount).toBe(1)
  })

  it('hides completed daily trainers', async () => {
    prisma.dailyTrainingDay.findUnique.mockResolvedValue({
      id: 'day-1',
      trainers: [
        {
          id: 't1',
          kind: 'daily',
          slot: 1,
          status: 'completed',
          sourceLabel: 'Palabras nuevas',
          words: [],
        },
        {
          id: 't2',
          kind: 'daily',
          slot: 2,
          status: 'not_started',
          sourceLabel: 'Palabras nuevas',
          words: [
            {
              userCard: {
                id: 'card-1',
                wordId: 'word-1',
                progress: 0,
                word: { spanish: 'casa', russian: 'дом' },
              },
            },
          ],
        },
      ],
    })
    prisma.userCard.findMany.mockResolvedValue([])

    const result = await service.getToday('user-1')
    expect(result.trainers.map((item) => item.id)).toEqual(['t2'])
  })
})

describe('TrainingService.getTrainerSession', () => {
  const prisma = createPrismaMock()
  let service: TrainingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TrainingService(prisma as never)
  })

  it('returns full session words with showIntro from completedTrainerCount', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue({
      id: 'trainer-1',
      kind: 'daily',
      slot: 1,
      sourceLabel: 'Palabras nuevas',
      words: [
        {
          userCard: {
            id: 'card-1',
            wordId: 'word-1',
            progress: 0,
            completedTrainerCount: 0,
            word: {
              spanish: 'hola',
              russian: 'привет',
              additionalTranslations: ['здравствуй'],
              definitionEs: 'Saludo',
              examples: ['Hola, ¿qué tal?'],
              partOfSpeech: 'interjección',
              gender: null,
              wrongRussian: ['a', 'b', 'c'],
              wrongSpanish: ['x', 'y', 'z'],
              imageUrl: null,
              imagePhotographerName: null,
              imagePhotographerUrl: null,
              imagePageUrl: null,
              imageProvider: null,
            },
          },
        },
        {
          userCard: {
            id: 'card-2',
            wordId: 'word-2',
            progress: 50,
            completedTrainerCount: 2,
            word: {
              spanish: 'casa',
              russian: 'дом',
              additionalTranslations: [],
              definitionEs: null,
              examples: [],
              partOfSpeech: 'sustantivo',
              gender: 'feminine',
              wrongRussian: ['a', 'b', 'c'],
              wrongSpanish: ['x', 'y', 'z'],
              imageUrl: null,
              imagePhotographerName: null,
              imagePhotographerUrl: null,
              imagePageUrl: null,
              imageProvider: null,
            },
          },
        },
      ],
    })

    const result = await service.getTrainerSession('user-1', 'trainer-1')

    expect(result.id).toBe('trainer-1')
    expect(result.words).toHaveLength(2)
    expect(result.words[0]).toMatchObject({
      spanish: 'hola',
      showIntro: true,
      completedTrainerCount: 0,
    })
    expect(result.words[1]).toMatchObject({
      spanish: 'casa',
      showIntro: false,
      completedTrainerCount: 2,
    })
  })

  it('throws NotFoundException when trainer is missing or not owned', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue(null)

    await expect(
      service.getTrainerSession('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('TrainingService.completeTrainer', () => {
  const prisma = createPrismaMock()
  let service: TrainingService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof prisma._tx) => Promise<unknown>) =>
        callback(prisma._tx),
    )
    service = new TrainingService(prisma as never)
  })

  it('updates progress, marks trainer completed, and returns deltas', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue({
      id: 'trainer-1',
      status: 'not_started',
      day: { id: 'day-1' },
      words: [
        sessionWord({ id: 'card-1', progress: 40, spanish: 'hola' }),
        sessionWord({
          id: 'card-2',
          progress: 95,
          spanish: 'casa',
          russian: 'дом',
        }),
      ],
    })
    prisma.dailyTrainer.findMany.mockResolvedValue([
      {
        id: 'trainer-1',
        kind: 'daily',
        status: 'completed',
        slot: 1,
      },
      {
        id: 'trainer-2',
        kind: 'daily',
        status: 'not_started',
        slot: 2,
      },
    ])

    const result = await service.completeTrainer('user-1', 'trainer-1', [
      { userCardId: 'card-1', errorCount: 0 },
      { userCardId: 'card-2', errorCount: 2 },
    ])

    expect(result.cards).toEqual([
      {
        userCardId: 'card-1',
        spanish: 'hola',
        russian: 'привет',
        errorCount: 0,
        oldProgress: 40,
        delta: 20,
        newProgress: 60,
      },
      {
        userCardId: 'card-2',
        spanish: 'casa',
        russian: 'дом',
        errorCount: 2,
        oldProgress: 95,
        delta: -10,
        newProgress: 85,
      },
    ])
    expect(result).toMatchObject({
      wordCount: 2,
      dailyTotal: 2,
      dailyCompleted: 1,
      nextTrainerId: 'trainer-2',
    })

    expect(prisma._tx.userCard.update).toHaveBeenCalledTimes(2)
    expect(prisma._tx.userCard.update).toHaveBeenCalledWith({
      where: { id: 'card-1' },
      data: {
        progress: 60,
        lastTrainedAt: expect.any(Date),
        completedTrainerCount: { increment: 1 },
        showCount: { increment: 1 },
      },
    })
    expect(prisma._tx.dailyTrainer.update).toHaveBeenCalledWith({
      where: { id: 'trainer-1' },
      data: {
        status: 'completed',
        startedAt: null,
        completedAt: null,
      },
    })
    expect(prisma._tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastCompletedTrainerAt: expect.any(Date) },
    })
  })

  it('stores client startedAt and completedAt when the pair is valid', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue({
      id: 'trainer-1',
      status: 'not_started',
      day: { id: 'day-1' },
      words: [sessionWord({ id: 'card-1', progress: 0 })],
    })
    prisma.dailyTrainer.findMany.mockResolvedValue([
      {
        id: 'trainer-1',
        kind: 'daily',
        status: 'completed',
        slot: 1,
      },
      {
        id: 'trainer-2',
        kind: 'daily',
        status: 'not_started',
        slot: 2,
      },
    ])

    const startedAt = new Date(Date.now() - 5 * 60_000).toISOString()
    const completedAt = new Date().toISOString()

    await service.completeTrainer(
      'user-1',
      'trainer-1',
      [{ userCardId: 'card-1', errorCount: 0 }],
      { startedAt, completedAt },
    )

    expect(prisma._tx.dailyTrainer.update).toHaveBeenCalledWith({
      where: { id: 'trainer-1' },
      data: {
        status: 'completed',
        startedAt: new Date(startedAt),
        completedAt: new Date(completedAt),
      },
    })
  })

  it('ignores invalid client times without failing completion', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue({
      id: 'trainer-1',
      status: 'not_started',
      day: { id: 'day-1' },
      words: [sessionWord({ id: 'card-1', progress: 0 })],
    })
    prisma.dailyTrainer.findMany.mockResolvedValue([
      {
        id: 'trainer-1',
        kind: 'daily',
        status: 'completed',
        slot: 1,
      },
      {
        id: 'trainer-2',
        kind: 'daily',
        status: 'not_started',
        slot: 2,
      },
    ])

    const result = await service.completeTrainer(
      'user-1',
      'trainer-1',
      [{ userCardId: 'card-1', errorCount: 0 }],
      { startedAt: 'not-a-date', completedAt: new Date().toISOString() },
    )

    expect(result.wordCount).toBe(1)
    expect(prisma._tx.dailyTrainer.update).toHaveBeenCalledWith({
      where: { id: 'trainer-1' },
      data: {
        status: 'completed',
        startedAt: null,
        completedAt: null,
      },
    })
  })

  it('returns null nextTrainerId when the day has no open trainers', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue({
      id: 'trainer-1',
      status: 'not_started',
      day: { id: 'day-1' },
      words: [sessionWord({ id: 'card-1', progress: 0 })],
    })
    prisma.dailyTrainer.findMany.mockResolvedValue([
      {
        id: 'trainer-1',
        kind: 'daily',
        status: 'completed',
        slot: 1,
      },
    ])
    prisma.dailyTrainerWord.findMany.mockResolvedValue([])
    prisma.userCard.findMany.mockResolvedValue([])
    prisma.dailyTrainer.count.mockResolvedValue(0)
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      currentLessonId: null,
      lastCompletedTrainerAt: null,
      currentLesson: null,
    })
    prisma.lesson.findMany.mockResolvedValue([])

    const result = await service.completeTrainer('user-1', 'trainer-1', [
      { userCardId: 'card-1', errorCount: 0 },
    ])

    expect(result.nextTrainerId).toBeNull()
    expect(result.dailyTotal).toBe(1)
    expect(result.dailyCompleted).toBe(1)
  })

  it('rejects already completed trainers', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue({
      id: 'trainer-1',
      status: 'completed',
      words: [sessionWord()],
    })

    await expect(
      service.completeTrainer('user-1', 'trainer-1', [
        { userCardId: 'card-1', errorCount: 0 },
      ]),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects incomplete card payloads', async () => {
    prisma.dailyTrainer.findFirst.mockResolvedValue({
      id: 'trainer-1',
      status: 'not_started',
      words: [sessionWord({ id: 'card-1' }), sessionWord({ id: 'card-2' })],
    })

    await expect(
      service.completeTrainer('user-1', 'trainer-1', [
        { userCardId: 'card-1', errorCount: 0 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
