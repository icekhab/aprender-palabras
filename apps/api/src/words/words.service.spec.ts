import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateWordCardInput, WordDraft } from '@aprender-palabras/contracts'
import { OpenAiService } from '../integrations/openai/openai.service.js'
import { UnsplashService } from '../integrations/unsplash/unsplash.service.js'
import { PrismaService } from '../prisma.service.js'
import { WordsService } from './words.service.js'

const emptyDraft = (overrides: Partial<WordDraft> = {}): WordDraft => ({
  spanish: 'esperar',
  russian: 'ждать',
  additionalTranslations: [],
  definitionEs: null,
  examples: [],
  partOfSpeech: null,
  gender: null,
  wrongRussian: [],
  wrongSpanish: [],
  imageUrl: null,
  imagePhotographerName: null,
  imagePhotographerUrl: null,
  imagePageUrl: null,
  imageProvider: null,
  imageDownloadLocation: null,
  ...overrides,
})

describe('WordsService', () => {
  const tx = {
    word: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCard: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    lessonWord: {
      deleteMany: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  const prisma = {
    $transaction: vi.fn<
      (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
    >(async (callback) => callback(tx)),
    word: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCard: {
      count: vi.fn<(args: unknown) => Promise<number>>(),
      aggregate: vi.fn<(args: unknown) => Promise<{ _avg: { progress: number | null } }>>(),
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      findFirst: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
      delete: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    lessonWord: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
      deleteMany: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  const openAiService = {
    isConfigured: vi.fn<() => boolean>(),
    generateUnsplashQuery: vi.fn<
      (spanish: string, russian: string) => Promise<string>
    >(),
    generateWordContent: vi.fn<
      (
        spanish: string,
        russian: string,
      ) => Promise<{
        additionalTranslations: string[]
        definitionEs: string | null
        examples: string[]
        partOfSpeech: string | null
        gender: 'masculine' | 'feminine' | null
        wrongRussian: string[]
        wrongSpanish: string[]
        unsplashQuery: string
      }>
    >(),
  }

  const unsplashService = {
    isConfigured: vi.fn<() => boolean>(),
    searchImage: vi.fn<(query: string, options?: unknown) => Promise<unknown>>(),
    trackDownload: vi.fn<(downloadLocation: string) => Promise<void>>(),
  }

  let service: WordsService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    )
    service = new WordsService(
      prisma as unknown as PrismaService,
      openAiService as unknown as OpenAiService,
      unsplashService as unknown as UnsplashService,
    )
  })

  it('returns generated draft with image when services succeed', async () => {
    openAiService.isConfigured.mockReturnValue(true)
    openAiService.generateWordContent.mockResolvedValue({
      additionalTranslations: ['ожидать'],
      definitionEs: 'Tener esperanza de algo.',
      examples: ['Espero tu llamada.'],
      partOfSpeech: 'verbo',
      gender: null,
      wrongRussian: ['бежать', 'читать', 'писать'],
      wrongSpanish: ['comer', 'vivir', 'hablar'],
      unsplashQuery: 'waiting person',
    })
    unsplashService.searchImage.mockResolvedValue({
      imageUrl: 'https://images.unsplash.com/photo.jpg',
      imagePhotographerName: 'Ada',
      imagePhotographerUrl: 'https://unsplash.com/@ada',
      imagePageUrl: 'https://unsplash.com/photos/abc',
      imageProvider: 'unsplash',
      imageDownloadLocation: 'https://api.unsplash.com/photos/abc/download',
    })

    await expect(
      service.preview({ spanish: 'esperar', russian: 'ждать' }),
    ).resolves.toMatchObject({
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: ['ожидать'],
      imageUrl: 'https://images.unsplash.com/photo.jpg',
      imageProvider: 'unsplash',
    })
  })

  it('returns empty optional fields when OpenAI is not configured', async () => {
    openAiService.isConfigured.mockReturnValue(false)

    await expect(
      service.preview({ spanish: 'esperar', russian: 'ждать' }),
    ).resolves.toEqual({
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: [],
      definitionEs: null,
      examples: [],
      partOfSpeech: null,
      gender: null,
      wrongRussian: [],
      wrongSpanish: [],
      imageUrl: null,
      imagePhotographerName: null,
      imagePhotographerUrl: null,
      imagePageUrl: null,
      imageProvider: null,
      imageDownloadLocation: null,
    })
    expect(openAiService.generateWordContent).not.toHaveBeenCalled()
  })

  it('returns empty optional fields when OpenAI fails', async () => {
    openAiService.isConfigured.mockReturnValue(true)
    openAiService.generateWordContent.mockRejectedValue(new Error('network'))

    await expect(
      service.preview({ spanish: 'esperar', russian: 'ждать' }),
    ).resolves.toMatchObject({
      spanish: 'esperar',
      russian: 'ждать',
      examples: [],
      imageUrl: null,
    })
  })

  it('creates a word and user card when the pair is new', async () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    const createdWord = {
      id: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: [],
      definitionEs: null,
      examples: [],
      partOfSpeech: null,
      gender: null,
      wrongRussian: [],
      wrongSpanish: [],
      imageUrl: 'https://images.unsplash.com/photo.jpg',
      imagePhotographerName: 'Ada',
      imagePhotographerUrl: 'https://unsplash.com/@ada',
      imagePageUrl: 'https://unsplash.com/photos/abc',
      imageProvider: 'unsplash' as const,
      createdAt: now,
      updatedAt: now,
    }

    tx.word.findUnique.mockResolvedValue(null)
    tx.word.create.mockResolvedValue(createdWord)
    tx.userCard.findUnique.mockResolvedValue(null)
    tx.userCard.create.mockResolvedValue({ id: 'card-1' })

    const draft = emptyDraft({
      imageUrl: 'https://images.unsplash.com/photo.jpg',
      imagePhotographerName: 'Ada',
      imagePhotographerUrl: 'https://unsplash.com/@ada',
      imagePageUrl: 'https://unsplash.com/photos/abc',
      imageProvider: 'unsplash',
      imageDownloadLocation: 'https://api.unsplash.com/photos/abc/download',
    })

    await expect(service.create('user-1', draft)).resolves.toMatchObject({
      id: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
      createdAt: now.toISOString(),
    })

    expect(tx.word.create).toHaveBeenCalled()
    expect(tx.userCard.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'word-1',
        source: 'manual',
        inDictionary: true,
        progress: 0,
      },
    })
    expect(unsplashService.trackDownload).toHaveBeenCalledWith(
      'https://api.unsplash.com/photos/abc/download',
    )
  })

  it('reuses an existing word and creates only a user card', async () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    const existingWord = {
      id: 'word-existing',
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: ['ожидать'],
      definitionEs: 'Esperar algo.',
      examples: ['Espero tu llamada.'],
      partOfSpeech: 'verbo',
      gender: null,
      wrongRussian: [],
      wrongSpanish: [],
      imageUrl: null,
      imagePhotographerName: null,
      imagePhotographerUrl: null,
      imagePageUrl: null,
      imageProvider: null,
      createdAt: now,
      updatedAt: now,
    }

    tx.word.findUnique.mockResolvedValue(existingWord)
    tx.userCard.findUnique.mockResolvedValue(null)
    tx.userCard.create.mockResolvedValue({ id: 'card-2' })

    await expect(service.create('user-1', emptyDraft())).resolves.toMatchObject({
      id: 'word-existing',
      spanish: 'esperar',
      russian: 'ждать',
    })

    expect(tx.word.create).not.toHaveBeenCalled()
    expect(tx.userCard.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'word-existing',
        source: 'manual',
        inDictionary: true,
        progress: 0,
      },
    })
  })

  it('lists an empty dictionary with zero average progress', async () => {
    prisma.userCard.count.mockResolvedValue(0)
    prisma.userCard.aggregate.mockResolvedValue({ _avg: { progress: null } })
    prisma.userCard.findMany.mockResolvedValue([])

    await expect(
      service.list('user-1', { limit: 20, offset: 0 }),
    ).resolves.toEqual({
      totalCount: 0,
      averageProgress: 0,
      hasMore: false,
      items: [],
    })

    expect(prisma.userCard.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', inDictionary: true },
      include: { word: true },
      orderBy: { addedAt: 'desc' },
      skip: 0,
      take: 20,
    })
  })

  it('lists dictionary cards with average progress and hasMore', async () => {
    const addedAt = new Date('2026-10-18T12:00:00.000Z')
    prisma.userCard.count.mockResolvedValue(21)
    prisma.userCard.aggregate.mockResolvedValue({ _avg: { progress: 50.4 } })
    prisma.userCard.findMany.mockResolvedValue([
      {
        id: 'card-1',
        wordId: 'word-1',
        progress: 100,
        addedAt,
        word: { spanish: 'esperar', russian: 'ждать' },
      },
    ])

    await expect(
      service.list('user-1', { limit: 20, offset: 0 }),
    ).resolves.toEqual({
      totalCount: 21,
      averageProgress: 50,
      hasMore: true,
      items: [
        {
          id: 'card-1',
          wordId: 'word-1',
          spanish: 'esperar',
          russian: 'ждать',
          progress: 100,
          addedAt: addedAt.toISOString(),
        },
      ],
    })
  })

  it('returns a user card detail with lessons and readiness', async () => {
    const addedAt = new Date('2026-10-18T12:00:00.000Z')
    prisma.userCard.findFirst.mockResolvedValue({
      id: 'card-1',
      wordId: 'word-1',
      progress: 60,
      inDictionary: true,
      source: 'manual',
      addedAt,
      word: {
        spanish: 'esperar',
        russian: 'ждать',
        additionalTranslations: ['ожидать'],
        definitionEs: 'Tener esperanza.',
        examples: ['Espero tu llamada.'],
        partOfSpeech: 'verbo',
        gender: null,
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
        imageUrl: null,
        imagePhotographerName: null,
        imagePhotographerUrl: null,
        imagePageUrl: null,
        imageProvider: null,
      },
    })
    prisma.lessonWord.findMany.mockResolvedValue([
      { lesson: { id: 'lesson-1', title: 'Uno' } },
    ])

    await expect(service.getCard('user-1', 'card-1')).resolves.toMatchObject({
      id: 'card-1',
      wordId: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
      progress: 60,
      ready: true,
      missingFields: [],
      lessons: [{ id: 'lesson-1', title: 'Uno' }],
    })
  })

  it('throws NotFoundException when the card is missing', async () => {
    prisma.userCard.findFirst.mockResolvedValue(null)

    await expect(service.getCard('user-1', 'card-missing')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('resets progress and training counters as if the word was just added', async () => {
    prisma.userCard.findFirst.mockResolvedValue({ id: 'card-1' })
    prisma.userCard.update.mockResolvedValue({
      id: 'card-1',
      wordId: 'word-1',
      progress: 0,
      inDictionary: true,
      source: 'manual',
      addedAt: new Date('2026-10-18T12:00:00.000Z'),
      word: {
        spanish: 'esperar',
        russian: 'ждать',
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
    })
    prisma.lessonWord.findMany.mockResolvedValue([])

    await expect(service.resetProgress('user-1', 'card-1')).resolves.toMatchObject({
      progress: 0,
    })

    expect(prisma.userCard.update).toHaveBeenCalledWith({
      where: { id: 'card-1' },
      data: {
        progress: 0,
        lastTrainedAt: null,
        completedTrainerCount: 0,
        showCount: 0,
      },
      include: { word: true },
    })
  })

  it('deletes the card and lesson links for the user', async () => {
    prisma.userCard.findFirst.mockResolvedValue({
      id: 'card-1',
      wordId: 'word-1',
    })

    await expect(service.deleteCard('user-1', 'card-1')).resolves.toBeUndefined()

    expect(tx.lessonWord.deleteMany).toHaveBeenCalledWith({
      where: {
        wordId: 'word-1',
        lesson: { userId: 'user-1' },
      },
    })
    expect(tx.userCard.delete).toHaveBeenCalledWith({
      where: { id: 'card-1' },
    })
  })

  it('filters dictionary cards by spanish or russian substring', async () => {
    const listWhere = {
      userId: 'user-1',
      inDictionary: true,
      word: {
        OR: [
          { spanish: { contains: 'Esp', mode: 'insensitive' } },
          { russian: { contains: 'Esp', mode: 'insensitive' } },
        ],
      },
    }
    prisma.userCard.count.mockImplementation(
      async (args: { where: unknown }) => {
        if (JSON.stringify(args.where) === JSON.stringify(listWhere)) {
          return 1
        }

        return 7
      },
    )
    prisma.userCard.aggregate.mockResolvedValue({ _avg: { progress: 60 } })
    prisma.userCard.findMany.mockResolvedValue([
      {
        id: 'card-1',
        wordId: 'word-1',
        progress: 50,
        addedAt: new Date('2026-10-18T12:00:00.000Z'),
        word: { spanish: 'esperar', russian: 'ждать' },
      },
    ])

    await expect(
      service.list('user-1', { limit: 20, offset: 0, q: 'Esp' }),
    ).resolves.toMatchObject({
      totalCount: 7,
      averageProgress: 60,
      hasMore: false,
      items: [{ spanish: 'esperar', russian: 'ждать' }],
    })

    expect(prisma.userCard.aggregate).toHaveBeenCalledWith({
      where: { userId: 'user-1', inDictionary: true },
      _avg: { progress: true },
    })
    expect(prisma.userCard.findMany).toHaveBeenCalledWith({
      where: listWhere,
      include: { word: true },
      orderBy: { addedAt: 'desc' },
      skip: 0,
      take: 20,
    })
  })

  it('throws ConflictException when the user already has the card', async () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    tx.word.findUnique.mockResolvedValue({
      id: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: [],
      definitionEs: null,
      examples: [],
      partOfSpeech: null,
      gender: null,
      wrongRussian: [],
      wrongSpanish: [],
      imageUrl: null,
      imagePhotographerName: null,
      imagePhotographerUrl: null,
      imagePageUrl: null,
      imageProvider: null,
      createdAt: now,
      updatedAt: now,
    })
    tx.userCard.findUnique.mockResolvedValue({ id: 'card-existing' })

    await expect(service.create('user-1', emptyDraft())).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(tx.userCard.create).not.toHaveBeenCalled()
  })

  it('adds an existing word to the user dictionary', async () => {
    const addedAt = new Date('2026-10-18T12:00:00.000Z')
    prisma.word.findUnique.mockResolvedValue({
      id: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
    })
    prisma.userCard.findUnique.mockResolvedValue(null)
    prisma.userCard.create.mockResolvedValue({
      id: 'card-1',
      wordId: 'word-1',
      progress: 0,
      addedAt,
    })

    await expect(
      service.addExisting('user-1', 'word-1'),
    ).resolves.toEqual({
      id: 'card-1',
      wordId: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
      progress: 0,
      addedAt: addedAt.toISOString(),
    })

    expect(prisma.userCard.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'word-1',
        source: 'manual',
        inDictionary: true,
        progress: 0,
      },
    })
  })

  it('throws NotFoundException when adding a missing word', async () => {
    prisma.word.findUnique.mockResolvedValue(null)

    await expect(
      service.addExisting('user-1', 'missing-word'),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.userCard.create).not.toHaveBeenCalled()
  })

  it('throws ConflictException when adding a word the user already has', async () => {
    prisma.word.findUnique.mockResolvedValue({
      id: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
    })
    prisma.userCard.findUnique.mockResolvedValue({ id: 'card-existing' })

    await expect(
      service.addExisting('user-1', 'word-1'),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.userCard.create).not.toHaveBeenCalled()
  })

  it('updates word fields globally and clears gender when not sustantivo', async () => {
    const input: UpdateWordCardInput = {
      spanish: 'esperar',
      russian: 'ожидать',
      definitionEs: 'Tener esperanza o aguardar.',
      examples: ['Espero tu llamada.', 'Espero noticias.'],
      partOfSpeech: 'verbo',
      gender: null,
      wrongRussian: ['бежать', 'спать', 'есть'],
      wrongSpanish: ['correr', 'dormir', 'comer'],
      imageUrl: null,
      imagePhotographerName: null,
      imagePhotographerUrl: null,
      imagePageUrl: null,
      imageProvider: null,
      imageDownloadLocation: null,
    }

    prisma.userCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        wordId: 'word-1',
        word: {
          russian: 'ждать',
          normalizedSpanish: 'esperar',
          normalizedRussian: 'ждать',
          imageUrl: null,
        },
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        wordId: 'word-1',
        progress: 40,
        inDictionary: true,
        source: 'manual',
        addedAt: new Date('2026-10-18T12:00:00.000Z'),
        word: {
          spanish: 'esperar',
          russian: 'ожидать',
          additionalTranslations: [],
          definitionEs: input.definitionEs,
          examples: input.examples,
          partOfSpeech: 'verbo',
          gender: null,
          wrongRussian: input.wrongRussian,
          wrongSpanish: input.wrongSpanish,
          imageUrl: null,
          imagePhotographerName: null,
          imagePhotographerUrl: null,
          imagePageUrl: null,
          imageProvider: null,
        },
      })
    prisma.word.findUnique.mockResolvedValue(null)
    prisma.word.update.mockResolvedValue({})
    prisma.lessonWord.findMany.mockResolvedValue([])

    await expect(service.updateCard('user-1', 'card-1', input)).resolves.toMatchObject({
      russian: 'ожидать',
      partOfSpeech: 'verbo',
      gender: null,
      ready: true,
    })

    expect(prisma.word.update).toHaveBeenCalledWith({
      where: { id: 'word-1' },
      data: expect.objectContaining({
        russian: 'ожидать',
        normalizedRussian: 'ожидать',
        gender: null,
        partOfSpeech: 'verbo',
      }),
    })
  })

  it('throws ConflictException when updated russian pair already exists', async () => {
    prisma.userCard.findFirst.mockResolvedValue({
      id: 'card-1',
      wordId: 'word-1',
      word: {
        russian: 'ждать',
        normalizedSpanish: 'esperar',
        normalizedRussian: 'ждать',
        imageUrl: null,
      },
    })
    prisma.word.findUnique.mockResolvedValue({ id: 'word-other' })

    await expect(
      service.updateCard('user-1', 'card-1', {
        spanish: 'esperar',
        russian: 'надеться',
        definitionEs: 'Definición',
        examples: ['Uno.', 'Dos.'],
        partOfSpeech: 'verbo',
        gender: null,
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
        imageUrl: null,
        imagePhotographerName: null,
        imagePhotographerUrl: null,
        imagePageUrl: null,
        imageProvider: null,
        imageDownloadLocation: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.word.update).not.toHaveBeenCalled()
  })

  it('regenerates an image using AI query and Unsplash', async () => {
    openAiService.isConfigured.mockReturnValue(true)
    unsplashService.isConfigured.mockReturnValue(true)
    openAiService.generateUnsplashQuery.mockResolvedValue('waiting person')
    unsplashService.searchImage.mockResolvedValue({
      imageUrl: 'https://images.unsplash.com/new.jpg',
      imagePhotographerName: 'Ada',
      imagePhotographerUrl: 'https://unsplash.com/@ada',
      imagePageUrl: 'https://unsplash.com/photos/new',
      imageProvider: 'unsplash',
      imageDownloadLocation: 'https://api.unsplash.com/photos/new/download',
    })

    await expect(
      service.regenerateImage({
        spanish: 'esperar',
        russian: 'ждать',
        excludeImageUrl: 'https://images.unsplash.com/old.jpg',
      }),
    ).resolves.toMatchObject({
      imageUrl: 'https://images.unsplash.com/new.jpg',
      imageProvider: 'unsplash',
    })

    expect(unsplashService.searchImage).toHaveBeenCalledWith('waiting person', {
      excludeImageUrl: 'https://images.unsplash.com/old.jpg',
      perPage: 10,
    })
  })

  it('throws when image regeneration services are unavailable', async () => {
    openAiService.isConfigured.mockReturnValue(false)
    unsplashService.isConfigured.mockReturnValue(true)

    await expect(
      service.regenerateImage({
        spanish: 'esperar',
        russian: 'ждать',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
