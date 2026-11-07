import { ServiceUnavailableException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAiService } from '../integrations/openai/openai.service.js'
import { PrismaService } from '../prisma.service.js'
import { detectDirection, SuggestionsService } from './suggestions.service.js'

describe('detectDirection', () => {
  it('detects Russian input by Cyrillic characters', () => {
    expect(detectDirection('ждать')).toBe('ru-to-es')
    expect(detectDirection('hola ждать')).toBe('ru-to-es')
  })

  it('treats non-Cyrillic input as Spanish', () => {
    expect(detectDirection('esperar')).toBe('es-to-ru')
    expect(detectDirection('niño')).toBe('es-to-ru')
  })
})

describe('SuggestionsService', () => {
  const openAiService = {
    isConfigured: vi.fn<() => boolean>(),
    getTranslationSuggestions:
      vi.fn<
        (
          query: string,
          direction: 'ru-to-es' | 'es-to-ru',
        ) => Promise<Array<{ spanish: string; russian: string }>>
      >(),
  }

  const prisma = {
    word: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    },
    userCard: {
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    },
  }

  const quotaService = {
    consumeSuggestions: vi.fn<(userId: string) => Promise<void>>(),
    assertGenerationAvailable: vi.fn<(userId: string) => Promise<void>>(),
  }

  let service: SuggestionsService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.word.findMany.mockResolvedValue([])
    prisma.userCard.findMany.mockResolvedValue([])
    quotaService.consumeSuggestions.mockResolvedValue(undefined)
    quotaService.assertGenerationAvailable.mockResolvedValue(undefined)
    service = new SuggestionsService(
      openAiService as unknown as OpenAiService,
      prisma as unknown as PrismaService,
      quotaService as never,
    )
  })

  describe('suggestFromDb', () => {
    it('returns ranked dictionary matches with progress', async () => {
      prisma.word.findMany.mockResolvedValue([
        {
          id: 'word-2',
          spanish: 'el coche',
          russian: 'машина',
          searchSpanish: 'el coche',
          searchRussian: 'машина',
        },
        {
          id: 'word-1',
          spanish: 'coche',
          russian: 'автомобиль',
          searchSpanish: 'coche',
          searchRussian: 'автомобиль',
        },
        {
          id: 'word-3',
          spanish: 'consentir',
          russian: 'соглашаться',
          searchSpanish: 'consentir',
          searchRussian: 'соглашаться',
        },
      ])
      prisma.userCard.findMany.mockResolvedValue([
        { wordId: 'word-1', progress: 40 },
      ])

      await expect(service.suggestFromDb('user-1', 'coche')).resolves.toEqual({
        suggestions: [
          {
            spanish: 'coche',
            russian: 'автомобиль',
            wordId: 'word-1',
            progress: 40,
          },
          {
            spanish: 'el coche',
            russian: 'машина',
            wordId: 'word-2',
            progress: null,
          },
        ],
      })
      expect(quotaService.consumeSuggestions).not.toHaveBeenCalled()
      expect(openAiService.getTranslationSuggestions).not.toHaveBeenCalled()
    })

    it('matches accented query and accented words via search keys', async () => {
      prisma.word.findMany.mockResolvedValue([
        {
          id: 'word-1',
          spanish: 'cárcel',
          russian: 'тюрьма',
          searchSpanish: 'carcel',
          searchRussian: 'тюрьма',
        },
      ])

      await expect(service.suggestFromDb('user-1', 'cárc')).resolves.toEqual({
        suggestions: [
          {
            spanish: 'cárcel',
            russian: 'тюрьма',
            wordId: 'word-1',
            progress: null,
          },
        ],
      })
      expect(prisma.word.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { searchSpanish: { startsWith: 'carc' } },
              { searchSpanish: { contains: ' carc' } },
              { searchRussian: { startsWith: 'carc' } },
              { searchRussian: { contains: ' carc' } },
            ],
          },
        }),
      )
    })

    it('returns empty when nothing matches', async () => {
      prisma.word.findMany.mockResolvedValue([
        {
          id: 'word-3',
          spanish: 'consentir',
          russian: 'соглашаться',
          searchSpanish: 'consentir',
          searchRussian: 'соглашаться',
        },
      ])

      await expect(service.suggestFromDb('user-1', 'sentir')).resolves.toEqual({
        suggestions: [],
      })
    })
  })

  describe('suggestFromAi', () => {
    it('returns AI suggestions enriched with null dictionary fields', async () => {
      openAiService.isConfigured.mockReturnValue(true)
      openAiService.getTranslationSuggestions.mockResolvedValue([
        { spanish: 'esperar', russian: 'ждать' },
      ])

      await expect(service.suggestFromAi('user-1', 'ждать')).resolves.toEqual({
        suggestions: [
          {
            spanish: 'esperar',
            russian: 'ждать',
            wordId: null,
            progress: null,
          },
        ],
      })
      expect(quotaService.assertGenerationAvailable).toHaveBeenCalledWith(
        'user-1',
      )
      expect(quotaService.consumeSuggestions).toHaveBeenCalledWith('user-1')
      expect(openAiService.getTranslationSuggestions).toHaveBeenCalledWith(
        'ждать',
        'ru-to-es',
      )
    })

    it('attaches wordId when the pair exists in the shared dictionary', async () => {
      openAiService.isConfigured.mockReturnValue(true)
      openAiService.getTranslationSuggestions.mockResolvedValue([
        { spanish: 'Esperar', russian: 'Ждать' },
        { spanish: 'comer', russian: 'есть' },
      ])
      prisma.word.findMany.mockResolvedValue([
        {
          id: 'word-1',
          normalizedSpanish: 'esperar',
          normalizedRussian: 'ждать',
        },
      ])

      await expect(service.suggestFromAi('user-1', 'esper')).resolves.toEqual({
        suggestions: [
          {
            spanish: 'Esperar',
            russian: 'Ждать',
            wordId: 'word-1',
            progress: null,
          },
          {
            spanish: 'comer',
            russian: 'есть',
            wordId: null,
            progress: null,
          },
        ],
      })
      expect(prisma.userCard.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          wordId: { in: ['word-1'] },
          inDictionary: true,
        },
        select: {
          wordId: true,
          progress: true,
        },
      })
    })

    it('attaches progress when the word is already in the user dictionary', async () => {
      openAiService.isConfigured.mockReturnValue(true)
      openAiService.getTranslationSuggestions.mockResolvedValue([
        { spanish: 'esperar', russian: 'ждать' },
      ])
      prisma.word.findMany.mockResolvedValue([
        {
          id: 'word-1',
          normalizedSpanish: 'esperar',
          normalizedRussian: 'ждать',
        },
      ])
      prisma.userCard.findMany.mockResolvedValue([
        { wordId: 'word-1', progress: 40 },
      ])

      await expect(service.suggestFromAi('user-1', 'esperar')).resolves.toEqual({
        suggestions: [
          {
            spanish: 'esperar',
            russian: 'ждать',
            wordId: 'word-1',
            progress: 40,
          },
        ],
      })
    })

    it('throws when OpenAI is not configured', async () => {
      openAiService.isConfigured.mockReturnValue(false)

      await expect(
        service.suggestFromAi('user-1', 'esperar'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException)
      expect(quotaService.consumeSuggestions).not.toHaveBeenCalled()
    })

    it('throws when OpenAI request fails', async () => {
      openAiService.isConfigured.mockReturnValue(true)
      openAiService.getTranslationSuggestions.mockRejectedValue(
        new Error('network'),
      )

      await expect(
        service.suggestFromAi('user-1', 'esperar'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException)
    })
  })
})
