import { ConflictException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordDraft } from '@aprender-palabras/contracts'
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
    },
  }

  const prisma = {
    $transaction: vi.fn<
      (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
    >(async (callback) => callback(tx)),
  }

  const openAiService = {
    isConfigured: vi.fn<() => boolean>(),
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
    searchImage: vi.fn<(query: string) => Promise<unknown>>(),
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
})
