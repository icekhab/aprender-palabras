import { isKnownPartOfSpeech } from '@aprender-palabras/contracts'
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
  examples: z.array(z.string()).min(2).max(3),
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

    const distractorRules = `Distractor rules (apply to both wrongRussian and wrongSpanish; generate exactly 10 each):

1. Unambiguously wrong
- No distractor may match ANY possible meaning of the Spanish expression "${spanish}" (literal, figurative, colloquial, contextual).
- Exclude synonyms, alternate translations, and phrases that could be correct in some context.
- Example: for "una cita" with meaning "цитата", never use встреча / свидание / запись на приём (other valid senses of cita).

2. Plausible, not obvious
- Distractors must be comparable to the correct answer in length, difficulty, and grammatical structure.
- Avoid artificial, silly, or trivially easy options next to the correct answer.
- Do NOT make every distractor maximally similar to the correct answer.

3. Meaning diversity (across the set of 10)
- Mix close and distant meanings. Target mix: ~30% contextually close but different in meaning; ~40% neutral everyday situations; ~30% completely different domains.
- Do NOT generate all 10 from one semantic category.
- Goal: hard enough to prevent guessing by theme alone, but diverse in meaning.

4. Grammatical consistency
- Match the grammatical type of the source: noun→nouns, verb→verbs, adjective→adjectives, adverb→adverbs, fixed expression→comparable expressions, verb construction→verb constructions.
- Keep comparable length, word count, and grammatical complexity when possible.
- Example: if the answer is a verb phrase like "оставить отзыв", use verb phrases (e.g. "варить суп"), never a noun phrase like "сладкое яблоко".

5. Natural language and CEFR-aligned difficulty
- Use real, common, natural expressions.
- Match difficulty to the source expression (estimate if unknown from frequency and usage), not a fixed A2–B1 band:
  A1→mostly A1–A2; A2→mostly A2–B1; B1→mostly B1 (A2–B2 ok); B2→mostly B2 (B1–C1 ok); C1→mostly B2–C1; C2→mostly C1–C2.
- Do not use rare vocabulary only to raise difficulty.

6. No duplicates
- All 10 must differ in meaning; avoid synonyms among distractors; no rephrasings of the same idea; never duplicate the correct meaning.

Guiding principle: the learner should pick the right translation by knowing the Spanish word, not by guessing from grammar, length, theme, or an obvious difficulty gap.`

    const prompt = `Generate learner card content for the Spanish expression "${spanish}" with the primary Russian meaning "${russian}".

Rules:
- additionalTranslations: other Russian wordings of the SAME meaning only (not other senses). May be empty.
- definitionEs: a short definition in Spanish for this meaning, or null if unsure.
- examples: REQUIRED. Exactly 2 or 3 short natural Spanish example sentences for this meaning. Each sentence must use "${spanish}". Never return an empty list or fewer than 2 examples.
- partOfSpeech: Spanish part of speech label (e.g. verbo, sustantivo, adjetivo, expresión), or null.
- gender: masculine or feminine only for nouns when known; otherwise null.
- wrongRussian: exactly 10 Russian distractors. Apply the distractor rules below relative to "${russian}" / "${spanish}".
- wrongSpanish: exactly 10 Spanish distractors. Apply the distractor rules below relative to "${spanish}".
- unsplashQuery: a short English search phrase that visually represents this meaning for a stock photo.

${distractorRules}`

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'You help Spanish learners build bilingual vocabulary cards. Return only structured card content for one concrete Spanish–Russian meaning. Always include 2 or 3 Spanish example sentences. Follow the distractor rules strictly: unambiguously wrong (no other senses), grammatically matched, CEFR-aligned, diverse in meaning, natural, and non-obvious.',
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
  if (examples.length < 2) {
    throw new Error('OpenAI returned fewer than 2 examples')
  }
  const wrongRussian = uniqueNonEmpty(content.wrongRussian).slice(0, 10)
  const wrongSpanish = uniqueNonEmpty(content.wrongSpanish).slice(0, 10)
  const definitionEs = normalizeOptionalText(content.definitionEs)
  const rawPartOfSpeech = normalizeOptionalText(content.partOfSpeech)
  const partOfSpeech = isKnownPartOfSpeech(rawPartOfSpeech)
    ? rawPartOfSpeech
    : null
  const unsplashQuery =
    normalizeOptionalText(content.unsplashQuery) ?? 'spanish language'

  return {
    additionalTranslations,
    definitionEs,
    examples,
    partOfSpeech,
    gender: partOfSpeech === 'sustantivo' ? content.gender : null,
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
