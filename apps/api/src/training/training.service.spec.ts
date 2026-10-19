import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingService } from './training.service.js'

describe('TrainingService.getToday', () => {
  const prisma = {
    dailyTrainingDay: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainer: {
      count: vi.fn<(args: unknown) => Promise<number>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainerWord: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    },
    user: {
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCard: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      count: vi.fn<(args: unknown) => Promise<number>>(),
    },
    lesson: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    },
  }

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
