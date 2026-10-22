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

const wordContentSchema = z.object({
  additionalTranslations: z.array(z.string()).max(10),
  definitionEs: z.string().nullable(),
  examples: z.array(z.string()).max(3),
  partOfSpeech: z.string().nullable(),
  gender: z.enum(['masculine', 'feminine']).nullable(),
  wrongRussian: z.array(z.string()).length(10),
  wrongSpanish: z.array(z.string()).length(10),
  unsplashQuery: z.string(),
})

export type TranslationDirection = 'ru-to-es' | 'es-to-ru'

export interface TranslationSuggestion {
  spanish: string
  russian: string
}

export interface GeneratedWordContent {
  additionalTranslations: string[]
  definitionEs: string | null
  examples: string[]
  partOfSpeech: string | null
  gender: 'masculine' | 'feminine' | null
  wrongRussian: string[]
  wrongSpanish: string[]
  unsplashQuery: string
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

  async generateUnsplashQuery(
    spanish: string,
    russian: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI is not configured')
    }

    const unsplashQuerySchema = z.object({
      unsplashQuery: z.string(),
    })

    const prompt = `Suggest a short English Unsplash search phrase for a stock photo that visually represents the Spanish expression "${spanish}" with the Russian meaning "${russian}". Return only the search phrase.`

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'You suggest concise English photo search queries for vocabulary flashcards.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        text: {
          format: zodTextFormat(unsplashQuerySchema, 'unsplash_query'),
        },
      })

      const parsed = response.output_parsed
      const query = normalizeOptionalText(parsed?.unsplashQuery ?? null)
      return query ?? 'spanish language'
    } catch (error) {
      this.logger.error('OpenAI unsplash query request failed', error)
      throw error
    }
  }

  async generateWordContent(
    spanish: string,
    russian: string,
  ): Promise<GeneratedWordContent> {
    if (!this.client) {
      throw new Error('OpenAI is not configured')
    }

    const prompt = `Generate learner card content for the Spanish expression "${spanish}" with the primary Russian meaning "${russian}".

Rules:
- additionalTranslations: other Russian wordings of the SAME meaning only (not other senses). May be empty.
- definitionEs: a short definition in Spanish for this meaning, or null if unsure.
- examples: 2 or 3 short natural Spanish example sentences using this meaning.
- partOfSpeech: Spanish part of speech label (e.g. verbo, sustantivo, adjetivo, expresión), or null.
- gender: masculine or feminine only for nouns when known; otherwise null.
- wrongRussian: exactly 10 Russian distractors for multiple choice.
  - Match the grammatical shape of "${russian}": same part of speech / construction (verb phrase → verb phrases; noun → nouns; adjective → adjectives; fixed expression → similar fixed expressions). Example: if the answer is a verb phrase like "оставить отзыв", distractors must be verb phrases such as "варить суп" or "закрыть окно", never noun phrases like "сладкое яблоко".
  - Similar length (word count) and register so options look interchangeable in a quiz.
  - Must NOT match the primary translation or additionalTranslations.
  - Must NOT be another real sense of the same Spanish expression (e.g. if "${spanish}" means "${russian}", do not use Russian words for other meanings of "${spanish}").
  - Must NOT be synonyms, near-synonyms, or other real translations of "${spanish}".
  - Do not put all 10 in one topic: avoid a single theme cluster (e.g. not all food, or all weather). A few items may share a theme; the set as a whole should not feel mono-thematic. Themes need not all be mutually different.
  - All 10 must be distinct, natural Russian.
- wrongSpanish: exactly 10 Spanish distractors for multiple choice.
  - Match the grammatical shape of "${spanish}" the same way (verb phrase → verb phrases, etc.).
  - Similar length and register.
  - Must NOT match the Spanish expression "${spanish}".
  - Must NOT be synonyms, near-synonyms, compounds, or other senses of "${spanish}".
  - Do not put all 10 in one topic; the set should not feel mono-thematic. Themes need not all be mutually different.
  - All 10 must be distinct, natural Spanish.
- unsplashQuery: a short English search phrase that visually represents this meaning for a stock photo.`

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'You help Spanish learners build bilingual vocabulary cards. Return only structured card content for one concrete Spanish–Russian meaning. Distractors must match the target’s grammatical shape and length, never other senses of the same word, and must not all come from one single theme.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        text: {
          format: zodTextFormat(wordContentSchema, 'word_card_content'),
        },
      })

      const parsed = response.output_parsed
      if (!parsed) {
        throw new Error('OpenAI returned empty word content')
      }

      return sanitizeWordContent(parsed)
    } catch (error) {
      this.logger.error('OpenAI word content request failed', error)
      throw error
    }
  }
}

function sanitizeWordContent(
  content: GeneratedWordContent,
): GeneratedWordContent {
  const additionalTranslations = uniqueNonEmpty(content.additionalTranslations)
  const examples = uniqueNonEmpty(content.examples).slice(0, 3)
  const wrongRussian = uniqueNonEmpty(content.wrongRussian).slice(0, 10)
  const wrongSpanish = uniqueNonEmpty(content.wrongSpanish).slice(0, 10)
  const definitionEs = normalizeOptionalText(content.definitionEs)
  const partOfSpeech = normalizeOptionalText(content.partOfSpeech)
  const unsplashQuery =
    normalizeOptionalText(content.unsplashQuery) ?? 'spanish language'

  return {
    additionalTranslations,
    definitionEs,
    examples,
    partOfSpeech,
    gender: content.gender,
    wrongRussian: wrongRussian.length >= 3 ? wrongRussian : [],
    wrongSpanish: wrongSpanish.length >= 3 ? wrongSpanish : [],
    unsplashQuery,
  }
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const value of values) {
    const trimmed = value.replace(/\s+/g, ' ').trim()
    if (!trimmed) {
      continue
    }

    const key = trimmed.toLocaleLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(trimmed)
  }

  return unique
}

function normalizeOptionalText(value: string | null): string | null {
  if (value == null) {
    return null
  }

  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed || null
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
