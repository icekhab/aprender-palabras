import { ConflictException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonsService } from './lessons.service.js'
import { PrismaService } from '../prisma.service.js'

describe('LessonsService', () => {
  const tx = {
    lesson: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
      aggregate: vi.fn<(args: unknown) => Promise<{ _max: { position: number | null } }>>(),
      count: vi.fn<(args: unknown) => Promise<number>>(),
      findFirst: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    lessonWord: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
      aggregate: vi.fn<(args: unknown) => Promise<{ _max: { position: number | null } }>>(),
      count: vi.fn<(args: unknown) => Promise<number>>(),
    },
    user: {
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCard: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    word: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  const prisma = {
    $transaction: vi.fn<
      (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
    >(async (callback) => callback(tx)),
    lesson: tx.lesson,
    lessonWord: tx.lessonWord,
    user: tx.user,
    userCard: tx.userCard,
    word: tx.word,
  }

  let service: LessonsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new LessonsService(prisma as unknown as PrismaService)
  })

  it('creates a lesson at the end of the order', async () => {
    tx.lesson.aggregate.mockResolvedValue({ _max: { position: 2 } })
    tx.lesson.create.mockResolvedValue({
      id: 'lesson-3',
      userId: 'user-1',
      title: 'Viajes',
      position: 3,
      createdAt: new Date('2026-10-18T00:00:00.000Z'),
      words: [],
    })
    tx.user.findUniqueOrThrow.mockResolvedValue({ currentLessonId: null })

    const result = await service.create('user-1', { title: '  Viajes  ' })

    expect(tx.lesson.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        title: 'Viajes',
        position: 3,
      },
      include: {
        words: {
          include: { word: true },
          orderBy: { position: 'asc' },
        },
      },
    })
    expect(result.position).toBe(3)
    expect(result.status).toBe('undefined')
    expect(result.title).toBe('Viajes')
  })

  it('links an existing word and creates a prepared card when missing', async () => {
    tx.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      userId: 'user-1',
      title: 'Uno',
      position: 1,
      createdAt: new Date(),
      words: [],
    })
    tx.user.findUniqueOrThrow.mockResolvedValue({ currentLessonId: null })
    tx.word.findUnique.mockResolvedValue({
      id: 'word-1',
      spanish: 'hola',
      russian: 'привет',
      wrongRussian: ['a', 'b', 'c'],
      wrongSpanish: ['x', 'y', 'z'],
    })
    tx.lessonWord.findUnique.mockResolvedValue(null)
    tx.lessonWord.aggregate.mockResolvedValue({ _max: { position: 0 } })
    tx.userCard.findUnique.mockResolvedValue(null)
    tx.userCard.create.mockResolvedValue({})
    tx.lessonWord.create.mockResolvedValue({
      id: 'lw-1',
      lessonId: 'lesson-1',
      wordId: 'word-1',
      position: 1,
      addedAt: new Date('2026-10-18T00:00:00.000Z'),
    })
    tx.userCard.findUniqueOrThrow.mockResolvedValue({
      id: 'card-1',
      progress: 0,
      inDictionary: false,
    })

    const result = await service.addExistingWord(
      'user-1',
      'lesson-1',
      'word-1',
    )

    expect(tx.userCard.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'word-1',
        source: 'lesson',
        inDictionary: false,
        progress: 0,
      },
    })
    expect(result.inDictionary).toBe(false)
    expect(result.userCardId).toBe('card-1')
    expect(result.ready).toBe(true)
  })

  it('adds a word to the next lesson directly into the dictionary', async () => {
    tx.lesson.findFirst
      .mockResolvedValueOnce({
        id: 'lesson-2',
        userId: 'user-1',
        title: 'Dos',
        position: 2,
        createdAt: new Date(),
        words: [],
      })
      .mockResolvedValueOnce({ position: 1 })
    tx.user.findUniqueOrThrow.mockResolvedValue({ currentLessonId: 'lesson-1' })
    tx.word.findUnique.mockResolvedValue({
      id: 'word-1',
      spanish: 'hola',
      russian: 'привет',
      wrongRussian: ['a', 'b', 'c'],
      wrongSpanish: ['x', 'y', 'z'],
    })
    tx.lessonWord.findUnique.mockResolvedValue(null)
    tx.lessonWord.aggregate.mockResolvedValue({ _max: { position: 0 } })
    tx.userCard.findUnique.mockResolvedValue(null)
    tx.userCard.create.mockResolvedValue({})
    tx.lessonWord.create.mockResolvedValue({
      id: 'lw-1',
      lessonId: 'lesson-2',
      wordId: 'word-1',
      position: 1,
      addedAt: new Date('2026-10-18T00:00:00.000Z'),
    })
    tx.userCard.findUniqueOrThrow.mockResolvedValue({
      id: 'card-2',
      progress: 0,
      inDictionary: true,
    })

    const result = await service.addExistingWord(
      'user-1',
      'lesson-2',
      'word-1',
    )

    expect(tx.userCard.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'word-1',
        source: 'lesson',
        inDictionary: true,
        progress: 0,
      },
    })
    expect(result.inDictionary).toBe(true)
  })

  it('rejects adding a word that is already in the lesson', async () => {
    tx.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      userId: 'user-1',
      title: 'Uno',
      position: 1,
      createdAt: new Date(),
      words: [],
    })
    tx.user.findUniqueOrThrow.mockResolvedValue({ currentLessonId: null })
    tx.word.findUnique.mockResolvedValue({
      id: 'word-1',
      spanish: 'hola',
      russian: 'привет',
      wrongRussian: [],
      wrongSpanish: [],
    })
    tx.lessonWord.findUnique.mockResolvedValue({ id: 'lw-1' })

    await expect(
      service.addExistingWord('user-1', 'lesson-1', 'word-1'),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('throws when lesson is missing', async () => {
    tx.lesson.findFirst.mockResolvedValue(null)

    await expect(service.getById('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('transfers previous+current+next words into the dictionary when setting current', async () => {
    tx.user.findUniqueOrThrow.mockResolvedValue({ currentLessonId: null })
    tx.lesson.findFirst
      .mockResolvedValueOnce({
        id: 'lesson-2',
        userId: 'user-1',
        title: 'Dos',
        position: 2,
        createdAt: new Date('2026-10-18T00:00:00.000Z'),
        words: [
          {
            wordId: 'word-2',
            position: 1,
            addedAt: new Date('2026-10-18T00:00:00.000Z'),
            word: {
              spanish: 'dos',
              russian: 'два',
              wrongRussian: ['a', 'b', 'c'],
              wrongSpanish: ['x', 'y', 'z'],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'lesson-2',
        userId: 'user-1',
        title: 'Dos',
        position: 2,
        createdAt: new Date('2026-10-18T00:00:00.000Z'),
        words: [
          {
            wordId: 'word-2',
            position: 1,
            addedAt: new Date('2026-10-18T00:00:00.000Z'),
            word: {
              spanish: 'dos',
              russian: 'два',
              wrongRussian: ['a', 'b', 'c'],
              wrongSpanish: ['x', 'y', 'z'],
            },
          },
        ],
      })
    tx.lesson.findUnique.mockResolvedValue({
      id: 'lesson-3',
      title: 'Tres',
      position: 3,
    })
    tx.lesson.findMany.mockResolvedValue([
      {
        id: 'lesson-1',
        words: [{ wordId: 'word-1' }],
      },
      {
        id: 'lesson-2',
        words: [{ wordId: 'word-2' }],
      },
      {
        id: 'lesson-3',
        words: [{ wordId: 'word-3' }],
      },
    ])
    tx.userCard.findUnique
      .mockResolvedValueOnce({
        id: 'card-1',
        inDictionary: false,
      })
      .mockResolvedValueOnce({
        id: 'card-2',
        inDictionary: true,
      })
      .mockResolvedValueOnce(null)
    tx.userCard.findMany.mockResolvedValue([
      { wordId: 'word-2', progress: 40, inDictionary: true },
    ])

    await service.setCurrent('user-1', 'lesson-2')

    expect(tx.userCard.update).toHaveBeenCalledWith({
      where: { id: 'card-1' },
      data: { inDictionary: true },
    })
    expect(tx.userCard.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'word-3',
        source: 'lesson',
        inDictionary: true,
        progress: 0,
      },
    })
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { currentLessonId: 'lesson-2' },
    })
  })
})
