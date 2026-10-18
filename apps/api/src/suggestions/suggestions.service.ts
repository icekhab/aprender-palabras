import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { SuggestionsResponse } from '@aprender-palabras/contracts'
import {
  OpenAiService,
  type TranslationDirection,
} from '../integrations/openai/openai.service.js'

@Injectable()
export class SuggestionsService {
  constructor(private readonly openAiService: OpenAiService) {}

  async suggest(query: string): Promise<SuggestionsResponse> {
    if (!this.openAiService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Translation suggestions are unavailable',
      )
    }

    try {
      const suggestions = await this.openAiService.getTranslationSuggestions(
        query,
        detectDirection(query),
      )

      return { suggestions }
    } catch {
      throw new ServiceUnavailableException(
        'Translation suggestions are unavailable',
      )
    }
  }
}

export function detectDirection(query: string): TranslationDirection {
  return /\p{Script=Cyrillic}/u.test(query) ? 'ru-to-es' : 'es-to-ru'
}
