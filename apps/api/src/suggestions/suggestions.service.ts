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
import { QuotaService } from '../quotas/quota.service.js'
import {
  normalizeSearchKey,
  normalizeWordKey,
} from '../words/word-normalize.js'
import {
  rankDbSuggestionMatches,
  splitWords,
} from './word-prefix-match.js'

const DB_CANDIDATE_POOL = 100

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
  ) {}

  async suggestFromDb(
    userId: string,
    query: string,
  ): Promise<SuggestionsResponse> {
    const searchQuery = normalizeSearchKey(query)
    const tokens = splitWords(searchQuery)
    if (tokens.length === 0) {
      return { suggestions: [] }
    }

    const firstToken = tokens[0]!
    const direction = detectDirection(query)

    const candidates = await this.prisma.word.findMany({
      where: {
        OR: [
          { searchSpanish: { startsWith: firstToken } },
          { searchSpanish: { contains: ` ${firstToken}` } },
          { searchRussian: { startsWith: firstToken } },
          { searchRussian: { contains: ` ${firstToken}` } },
        ],
      },
      select: {
        id: true,
        spanish: true,
        russian: true,
        searchSpanish: true,
        searchRussian: true,
      },
      take: DB_CANDIDATE_POOL,
    })

    const ranked = rankDbSuggestionMatches(
      searchQuery,
      candidates,
      direction,
    )

    if (ranked.length === 0) {
      return { suggestions: [] }
    }

    const wordIds = ranked.map((word) => word.id)
    const cards = await this.prisma.userCard.findMany({
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

    return {
      suggestions: ranked.map((word) => ({
        spanish: word.spanish,
        russian: word.russian,
        wordId: word.id,
        progress: progressByWordId.get(word.id) ?? null,
      })),
    }
  }

  async suggestFromAi(
    userId: string,
    query: string,
  ): Promise<SuggestionsResponse> {
    if (!this.openAiService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Translation suggestions are unavailable',
      )
    }

    await this.quotaService.assertGenerationAvailable(userId)
    await this.quotaService.consumeSuggestions(userId)

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
