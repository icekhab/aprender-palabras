import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const DEFAULT_MODEL = 'gpt-6-sol'
const MAX_SUGGESTIONS = 8

const suggestionPairSchema = z.object({
  spanish: z.string(),
  russian: z.string(),
})

const suggestionsPayloadSchema = z.object({
  suggestions: z.array(suggestionPairSchema).max(MAX_SUGGESTIONS),
})

export type TranslationDirection = 'ru-to-es' | 'es-to-ru'

export interface TranslationSuggestion {
  spanish: string
  russian: string
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name)
  private readonly client: OpenAI | null
  private readonly model: string

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    this.model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
    this.client = apiKey ? new OpenAI({ apiKey }) : null
  }

  isConfigured(): boolean {
    return this.client !== null
  }

  async getTranslationSuggestions(
    query: string,
    direction: TranslationDirection,
  ): Promise<TranslationSuggestion[]> {
    if (!this.client) {
      throw new Error('OpenAI is not configured')
    }

    const formRules =
      'Use dictionary/lemma forms only: Russian verbs in infinitive; Russian nouns in nominative singular; Russian adjectives in the dictionary form. Spanish verbs in infinitive; Spanish nouns in singular dictionary form. Never list separate suggestions for gender, number, case, person, tense, or other inflected forms of the same lemma. Separate items only for different lemmas or different meanings. Each spanish and russian field must be a single primary wording (no semicolon lists).'

    const prompt =
      direction === 'ru-to-es'
        ? `The user typed a Russian prefix (possibly incomplete): "${query}". Treat it as autocomplete input, not a finished word. Infer the most likely complete Russian lemmas or short phrases that start with this prefix (or are very close if it looks like a typo). For each completion, return one Spanish translation pair. Prefer common learner vocabulary. Do not invent unrelated words. ${formRules} Return up to ${MAX_SUGGESTIONS} pairs.`
        : `The user typed a Spanish prefix (possibly incomplete): "${query}". Treat it as autocomplete input, not a finished word. Infer the most likely complete Spanish lemmas or short phrases that start with this prefix (or are very close if it looks like a typo). For each completion, return one Russian translation pair. Prefer common learner vocabulary. Do not invent unrelated words. ${formRules} Return up to ${MAX_SUGGESTIONS} pairs.`

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'You help Spanish learners with search autocomplete. The query may be a partial prefix. Complete likely dictionary lemmas/phrases and return structured translation suggestion pairs only. Never expand inflection paradigms.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        text: {
          format: zodTextFormat(
            suggestionsPayloadSchema,
            'translation_suggestions',
          ),
        },
      })

      const parsed = response.output_parsed
      if (!parsed) {
        return []
      }

      return dedupeSuggestions(parsed.suggestions)
    } catch (error) {
      this.logger.error('OpenAI suggestion request failed', error)
      throw error
    }
  }
}

function dedupeSuggestions(
  suggestions: TranslationSuggestion[],
): TranslationSuggestion[] {
  const seen = new Set<string>()
  const unique: TranslationSuggestion[] = []

  for (const suggestion of suggestions) {
    const spanish = suggestion.spanish.trim()
    const russian = suggestion.russian.trim()
    if (!spanish || !russian) {
      continue
    }

    const key = `${normalizeKey(spanish)}|${normalizeKey(russian)}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push({ spanish, russian })

    if (unique.length >= MAX_SUGGESTIONS) {
      break
    }
  }

  return unique
}

function normalizeKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}
