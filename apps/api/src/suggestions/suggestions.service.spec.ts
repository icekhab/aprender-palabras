import { ServiceUnavailableException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAiService } from '../integrations/openai/openai.service.js'
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

  let service: SuggestionsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SuggestionsService(openAiService as unknown as OpenAiService)
  })

  it('returns AI suggestions when OpenAI is configured', async () => {
    openAiService.isConfigured.mockReturnValue(true)
    openAiService.getTranslationSuggestions.mockResolvedValue([
      { spanish: 'esperar', russian: 'ждать' },
    ])

    await expect(service.suggest('ждать')).resolves.toEqual({
      suggestions: [{ spanish: 'esperar', russian: 'ждать' }],
    })
    expect(openAiService.getTranslationSuggestions).toHaveBeenCalledWith(
      'ждать',
      'ru-to-es',
    )
  })

  it('throws when OpenAI is not configured', async () => {
    openAiService.isConfigured.mockReturnValue(false)

    await expect(service.suggest('esperar')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('throws when OpenAI request fails', async () => {
    openAiService.isConfigured.mockReturnValue(true)
    openAiService.getTranslationSuggestions.mockRejectedValue(
      new Error('network'),
    )

    await expect(service.suggest('esperar')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })
})
