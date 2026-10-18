import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import type {
  SuggestionItem,
  SuggestionsResponse,
} from '@aprender-palabras/contracts'
import {
  OpenAiService,
  type TranslationDirection,
  type TranslationSuggestion,
} from '../integrations/openai/openai.service.js'
import { PrismaService } from '../prisma.service.js'
import { normalizeWordKey } from '../words/word-normalize.js'

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly prisma: PrismaService,
  ) {}

  async suggest(userId: string, query: string): Promise<SuggestionsResponse> {
    if (!this.openAiService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Translation suggestions are unavailable',
      )
    }

    let suggestions: TranslationSuggestion[]

    try {
      suggestions = await this.openAiService.getTranslationSuggestions(
        query,
        detectDirection(query),
      )
    } catch {
      throw new ServiceUnavailableException(
        'Translation suggestions are unavailable',
      )
    }

    return {
      suggestions: await this.enrichWithDictionary(userId, suggestions),
    }
  }

  private async enrichWithDictionary(
    userId: string,
    suggestions: TranslationSuggestion[],
  ): Promise<SuggestionItem[]> {
    if (suggestions.length === 0) {
      return []
    }

    const pairs = suggestions.map((item) => ({
      spanish: item.spanish,
      russian: item.russian,
      normalizedSpanish: normalizeWordKey(item.spanish),
      normalizedRussian: normalizeWordKey(item.russian),
    }))

    const words = await this.prisma.word.findMany({
      where: {
        OR: pairs.map((pair) => ({
          normalizedSpanish: pair.normalizedSpanish,
          normalizedRussian: pair.normalizedRussian,
        })),
      },
      select: {
        id: true,
        normalizedSpanish: true,
        normalizedRussian: true,
      },
    })

    const wordByPair = new Map(
      words.map((word) => [
        pairKey(word.normalizedSpanish, word.normalizedRussian),
        word.id,
      ]),
    )

    const wordIds = [...wordByPair.values()]
    const cards =
      wordIds.length === 0
        ? []
        : await this.prisma.userCard.findMany({
            where: {
              userId,
              wordId: { in: wordIds },
              inDictionary: true,
            },
            select: {
              wordId: true,
              progress: true,
            },
          })

    const progressByWordId = new Map(
      cards.map((card) => [card.wordId, card.progress]),
    )

    return pairs.map((pair) => {
      const wordId =
        wordByPair.get(
          pairKey(pair.normalizedSpanish, pair.normalizedRussian),
        ) ?? null
      const progress =
        wordId === null ? null : (progressByWordId.get(wordId) ?? null)

      return {
        spanish: pair.spanish,
        russian: pair.russian,
        wordId,
        progress,
      }
    })
  }
}

function pairKey(normalizedSpanish: string, normalizedRussian: string): string {
  return `${normalizedSpanish}\0${normalizedRussian}`
}

export function detectDirection(query: string): TranslationDirection {
  return /\p{Script=Cyrillic}/u.test(query) ? 'ru-to-es' : 'es-to-ru'
}
