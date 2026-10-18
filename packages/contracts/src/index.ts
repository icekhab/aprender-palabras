import { z } from 'zod'

export const loginSchema = z.object({
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
})

export type LoginInput = z.infer<typeof loginSchema>

export interface AuthUser {
  id: string
  login: string
}

export const suggestionsQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
})

export type SuggestionsQuery = z.infer<typeof suggestionsQuerySchema>

export interface SuggestionItem {
  spanish: string
  russian: string
}

export interface SuggestionsResponse {
  suggestions: SuggestionItem[]
}

export const wordPairSchema = z.object({
  spanish: z.string().trim().min(1).max(200),
  russian: z.string().trim().min(1).max(200),
})

export type WordPairInput = z.infer<typeof wordPairSchema>

export const wordGenderSchema = z.enum(['masculine', 'feminine'])

export type WordGender = z.infer<typeof wordGenderSchema>

export const wordDraftSchema = z.object({
  spanish: z.string().trim().min(1).max(200),
  russian: z.string().trim().min(1).max(200),
  additionalTranslations: z.array(z.string().trim().min(1).max(200)).max(10),
  definitionEs: z.string().trim().min(1).max(2000).nullable(),
  examples: z.array(z.string().trim().min(1).max(500)).max(3),
  partOfSpeech: z.string().trim().min(1).max(100).nullable(),
  gender: wordGenderSchema.nullable(),
  wrongRussian: z.array(z.string().trim().min(1).max(200)).max(3),
  wrongSpanish: z.array(z.string().trim().min(1).max(200)).max(3),
  imageUrl: z.string().trim().url().nullable(),
  imagePhotographerName: z.string().trim().min(1).max(200).nullable(),
  imagePhotographerUrl: z.string().trim().url().nullable(),
  imagePageUrl: z.string().trim().url().nullable(),
  imageProvider: z.literal('unsplash').nullable(),
  imageDownloadLocation: z.string().trim().url().nullable(),
})

export type WordDraft = z.infer<typeof wordDraftSchema>

export interface Word {
  id: string
  spanish: string
  russian: string
  additionalTranslations: string[]
  definitionEs: string | null
  examples: string[]
  partOfSpeech: string | null
  gender: WordGender | null
  wrongRussian: string[]
  wrongSpanish: string[]
  imageUrl: string | null
  imagePhotographerName: string | null
  imagePhotographerUrl: string | null
  imagePageUrl: string | null
  imageProvider: 'unsplash' | null
  createdAt: string
  updatedAt: string
}
