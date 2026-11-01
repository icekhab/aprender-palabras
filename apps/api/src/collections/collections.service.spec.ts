import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CollectionsService } from './collections.service.js'

function readyWord(
  overrides: Partial<{
    id: string
    spanish: string
    russian: string
    wrongRussian: string[]
    wrongSpanish: string[]
  }> = {},
) {
  return {
    id: overrides.id ?? 'word-1',
    spanish: overrides.spanish ?? 'hola',
    russian: overrides.russian ?? 'привет',
    wrongRussian: overrides.wrongRussian ?? ['a', 'b', 'c'],
    wrongSpanish: overrides.wrongSpanish ?? ['x', 'y', 'z'],
  }
}

describe('CollectionsService', () => {
  const prisma = {
    wordCollection: {
      findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(),
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    wordCollectionItem: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
      updateMany: vi.fn<(args: unknown) => Promise<unknown>>(),
      aggregate: vi.fn<
        (args: unknown) => Promise<{ _max: { position: number | null } }>
      >(),
    },
    userCollection: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(),
      upsert: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
      deleteMany: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCollectionIntroducedWord: {
      findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(),
      count: vi.fn<(args: unknown) => Promise<number>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      upsert: vi.fn<(args: unknown) => Promise<unknown>>(),
      deleteMany: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCard: {
      findMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(),
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    word: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainingDay: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainer: {
      count: vi.fn<(args: unknown) => Promise<number>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    dailyTrainerWord: {
      deleteMany: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    $transaction: vi.fn(),
  }

  const wordsService = {
    createAdminWord: vi.fn<(userId: string, draft: unknown) => Promise<{ id: string }>>(),
  }
  const service = new CollectionsService(
    prisma as never,
    wordsService as never,
  )

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    )
  })

  it('splits mine and catalog and hides added from catalog', async () => {
    prisma.wordCollection.findMany.mockResolvedValue([
      {
        id: 'col-mine',
        title: 'A mine',
        status: 'ready',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        items: [
          {
            wordId: 'word-1',
            position: 1,
            word: readyWord({ id: 'word-1' }),
          },
        ],
        memberships: [{ addedAt: new Date('2026-02-01') }],
      },
      {
        id: 'col-catalog',
        title: 'B catalog',
        status: 'ready',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        items: [],
        memberships: [],
      },
    ])
    prisma.userCard.findMany.mockResolvedValue([
      {
        id: 'card-1',
        wordId: 'word-1',
        progress: 40,
        inDictionary: true,
        source: 'manual',
        lastTrainedAt: null,
        completedTrainerCount: 0,
        showCount: 0,
        addedAt: new Date('2026-02-01'),
      },
    ])

    const result = await service.list('user-1', 'user')

    expect(result.mine).toHaveLength(1)
    expect(result.mine[0]?.id).toBe('col-mine')
    expect(result.mine[0]?.progress).toBe(40)
    expect(result.mine[0]?.canTrain).toBe(true)
    expect(result.catalog).toHaveLength(1)
    expect(result.catalog[0]?.id).toBe('col-catalog')
    expect(result.catalog[0]?.progress).toBeNull()
    expect(result.adminDrafts).toEqual([])
  })

  it('puts non-ready collections into adminDrafts for admin', async () => {
    prisma.wordCollection.findMany.mockResolvedValue([
      {
        id: 'col-draft',
        title: 'Draft',
        status: 'created',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        items: [],
        memberships: [],
      },
      {
        id: 'col-ready',
        title: 'Ready',
        status: 'ready',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        items: [],
        memberships: [],
      },
    ])
    prisma.userCard.findMany.mockResolvedValue([])

    const result = await service.list('admin-1', 'admin')

    expect(result.catalog.map((item) => item.id)).toEqual(['col-ready'])
    expect(result.adminDrafts.map((item) => item.id)).toEqual(['col-draft'])
  })

  it('rejects publishing an empty collection', async () => {
    prisma.wordCollection.findUnique.mockResolvedValue({
      id: 'col-1',
      title: 'Empty',
      status: 'created',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      items: [],
    })

    await expect(
      service.setStatus('admin-1', 'col-1', { status: 'ready' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects removing the last word from a ready collection', async () => {
    prisma.wordCollection.findUnique.mockResolvedValue({
      id: 'col-1',
      title: 'Ready',
      status: 'ready',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      items: [
        {
          wordId: 'word-1',
          position: 1,
          word: readyWord({ id: 'word-1' }),
        },
      ],
    })
    prisma.wordCollectionItem.findUnique.mockResolvedValue({
      id: 'item-1',
      position: 1,
    })

    await expect(
      service.removeWord('col-1', 'word-1'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('deactivating strips memberships and provenance', async () => {
    prisma.wordCollection.findUnique
      .mockResolvedValueOnce({
        id: 'col-1',
        title: 'Ready',
        status: 'ready',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        items: [
          {
            wordId: 'word-1',
            position: 1,
            word: readyWord({ id: 'word-1' }),
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'col-1',
        title: 'Ready',
        status: 'inactive',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        items: [
          {
            wordId: 'word-1',
            position: 1,
            word: readyWord({ id: 'word-1' }),
          },
        ],
      })
    prisma.userCollectionIntroducedWord.deleteMany.mockResolvedValue({
      count: 1,
    })
    prisma.userCollection.deleteMany.mockResolvedValue({ count: 1 })
    prisma.wordCollection.update.mockResolvedValue({})
    prisma.userCollection.findUnique.mockResolvedValue(null)
    prisma.userCard.findMany.mockResolvedValue([])

    const detail = await service.setStatus('admin-1', 'col-1', {
      status: 'inactive',
    })

    expect(prisma.userCollectionIntroducedWord.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'col-1' },
    })
    expect(prisma.userCollection.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'col-1' },
    })
    expect(detail.status).toBe('inactive')
  })

  it('adds missing words as manual with provenance and skips existing cards', async () => {
    prisma.wordCollection.findUnique.mockResolvedValue({
      id: 'col-1',
      title: 'Viaje',
      status: 'ready',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      items: [
        {
          wordId: 'word-new',
          position: 1,
          word: readyWord({ id: 'word-new' }),
        },
        {
          wordId: 'word-old',
          position: 2,
          word: readyWord({ id: 'word-old', spanish: 'adios' }),
        },
      ],
    })
    prisma.userCollection.upsert.mockResolvedValue({ id: 'uc-1' })
    prisma.userCard.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'card-old',
        inDictionary: true,
      })
    prisma.userCard.create.mockResolvedValue({ id: 'card-new' })
    prisma.userCollectionIntroducedWord.create.mockResolvedValue({})
    prisma.userCollection.findUnique.mockResolvedValue({
      addedAt: new Date('2026-02-01'),
    })
    prisma.userCard.findMany.mockResolvedValue([
      {
        id: 'card-new',
        wordId: 'word-new',
        progress: 0,
        inDictionary: true,
        source: 'manual',
        lastTrainedAt: null,
        completedTrainerCount: 0,
        showCount: 0,
        addedAt: new Date('2026-02-01'),
      },
      {
        id: 'card-old',
        wordId: 'word-old',
        progress: 70,
        inDictionary: true,
        source: 'lesson',
        lastTrainedAt: null,
        completedTrainerCount: 2,
        showCount: 2,
        addedAt: new Date('2026-01-10'),
      },
    ])

    const detail = await service.addForUser('user-1', 'col-1')

    expect(prisma.userCard.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'word-new',
        source: 'manual',
        inDictionary: true,
      },
    })
    expect(prisma.userCollectionIntroducedWord.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        collectionId: 'col-1',
        wordId: 'word-new',
      },
    })
    expect(prisma.userCard.update).not.toHaveBeenCalled()
    expect(detail.words.find((w) => w.wordId === 'word-old')?.progress).toBe(70)
  })

  it('on remove purges only introduced untrained words unique to the collection', async () => {
    prisma.userCollection.findUnique.mockResolvedValue({ id: 'uc-1' })
    prisma.userCollectionIntroducedWord.findMany.mockResolvedValue([
      { wordId: 'word-purge' },
      { wordId: 'word-keep-trained' },
      { wordId: 'word-keep-other' },
    ])
    prisma.userCollectionIntroducedWord.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
    prisma.userCard.findUnique
      .mockResolvedValueOnce({
        id: 'card-purge',
        completedTrainerCount: 0,
      })
      .mockResolvedValueOnce({
        id: 'card-trained',
        completedTrainerCount: 1,
      })
    prisma.dailyTrainerWord.deleteMany.mockResolvedValue({ count: 0 })
    prisma.userCard.delete.mockResolvedValue({})
    prisma.userCollectionIntroducedWord.deleteMany.mockResolvedValue({
      count: 3,
    })
    prisma.userCollection.delete.mockResolvedValue({})

    await service.removeForUser('user-1', 'col-1')

    expect(prisma.userCard.delete).toHaveBeenCalledTimes(1)
    expect(prisma.userCard.delete).toHaveBeenCalledWith({
      where: { id: 'card-purge' },
    })
    expect(prisma.userCollection.delete).toHaveBeenCalledWith({
      where: { id: 'uc-1' },
    })
  })

  it('rejects trainer when collection is not added', async () => {
    prisma.userCollection.findUnique.mockResolvedValue(null)
    await expect(
      service.createTrainer('user-1', 'col-1'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('creates collection trainer with up to 12 ready words by priority', async () => {
    prisma.userCollection.findUnique.mockResolvedValue({ id: 'uc-1' })
    const items = Array.from({ length: 13 }, (_, index) => ({
      wordId: `word-${index}`,
      position: index + 1,
      word: readyWord({ id: `word-${index}`, spanish: `w${index}` }),
    }))
    prisma.wordCollection.findUnique.mockResolvedValue({
      id: 'col-1',
      title: 'Grande',
      status: 'ready',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      items,
    })
    prisma.userCard.findMany.mockResolvedValue(
      items.map((item, index) => ({
        id: `card-${index}`,
        wordId: item.wordId,
        progress: index,
        inDictionary: true,
        source: 'manual' as const,
        lastTrainedAt: null,
        completedTrainerCount: 0,
        showCount: 0,
        addedAt: new Date('2026-02-01'),
      })),
    )
    prisma.dailyTrainingDay.findUnique.mockResolvedValue({ id: 'day-1' })
    prisma.dailyTrainer.count.mockResolvedValue(0)
    prisma.dailyTrainer.create.mockResolvedValue({ id: 'trainer-1' })

    const result = await service.createTrainer('user-1', 'col-1')

    expect(result.trainerId).toBe('trainer-1')
    const createArg = prisma.dailyTrainer.create.mock.calls[0]?.[0] as {
      data: {
        kind: string
        sourceLabel: string
        words: { create: Array<{ userCardId: string }> }
      }
    }
    expect(createArg.data.kind).toBe('collection')
    expect(createArg.data.sourceLabel).toBe('Grande')
    expect(createArg.data.words.create).toHaveLength(12)
    expect(createArg.data.words.create[0]?.userCardId).toBe('card-0')
  })

  it('throws when deleting unknown collection', async () => {
    prisma.wordCollection.findUnique.mockResolvedValue(null)
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
