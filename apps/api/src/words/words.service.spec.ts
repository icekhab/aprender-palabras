import { ConflictException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAiService } from '../integrations/openai/openai.service.js'
import { UnsplashService } from '../integrations/unsplash/unsplash.service.js'
import { PrismaService } from '../prisma.service.js'
import { WordsService } from './words.service.js'

describe('WordsService', () => {
  const prisma = {
    word: {
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
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

  it('creates a word and tracks unsplash download', async () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    prisma.word.create.mockResolvedValue({
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
      imageProvider: 'unsplash',
      createdAt: now,
      updatedAt: now,
    })

    const draft = {
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
      imageDownloadLocation: 'https://api.unsplash.com/photos/abc/download',
    }

    await expect(service.create(draft)).resolves.toMatchObject({
      id: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
      createdAt: now.toISOString(),
    })
    expect(unsplashService.trackDownload).toHaveBeenCalledWith(
      'https://api.unsplash.com/photos/abc/download',
    )
  })

  it('throws ConflictException on duplicate pair', async () => {
    const { Prisma } = await import('../generated/prisma/client.js')
    prisma.word.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )

    await expect(
      service.create({
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
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})
