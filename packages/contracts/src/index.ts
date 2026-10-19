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
  /** Present when the pair exists in the shared Word dictionary. */
  wordId: string | null
  /** Present when the current user already has this word in their dictionary. */
  progress: number | null
}

export interface SuggestionsResponse {
  suggestions: SuggestionItem[]
}

export const addExistingWordSchema = z.object({
  wordId: z.string().uuid(),
})

export type AddExistingWordInput = z.infer<typeof addExistingWordSchema>

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

export const dictionaryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type DictionaryListQuery = z.infer<typeof dictionaryListQuerySchema>

export interface DictionaryListItem {
  id: string
  wordId: string
  spanish: string
  russian: string
  progress: number
  addedAt: string
}

export interface DictionaryListResponse {
  totalCount: number
  averageProgress: number
  hasMore: boolean
  items: DictionaryListItem[]
}

export const lessonListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type LessonListQuery = z.infer<typeof lessonListQuerySchema>

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export type CreateLessonInput = z.infer<typeof createLessonSchema>

export const renameLessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export type RenameLessonInput = z.infer<typeof renameLessonSchema>

export const moveLessonSchema = z.object({
  direction: z.enum(['up', 'down']),
})

export type MoveLessonInput = z.infer<typeof moveLessonSchema>

export const setCurrentLessonSchema = z.object({
  lessonId: z.string().uuid(),
})

export type SetCurrentLessonInput = z.infer<typeof setCurrentLessonSchema>

export const removeLessonWordSchema = z.object({
  disposition: z.enum(['keep_dictionary', 'delete_card']).optional(),
})

export type RemoveLessonWordInput = z.infer<typeof removeLessonWordSchema>

export type LessonStatus =
  | 'previous'
  | 'current'
  | 'next'
  | 'future'
  | 'undefined'

export interface LessonListItem {
  id: string
  title: string
  position: number
  status: LessonStatus
  wordCount: number
  readyCount: number
  averageProgress: number
  createdAt: string
}

export interface LessonListResponse {
  totalCount: number
  hasMore: boolean
  currentLessonId: string | null
  items: LessonListItem[]
}

export interface LessonWordItem {
  wordId: string
  spanish: string
  russian: string
  progress: number
  inDictionary: boolean
  ready: boolean
  missingFields: string[]
  position: number
  addedAt: string
}

export interface LessonDetail {
  id: string
  title: string
  position: number
  status: LessonStatus
  wordCount: number
  readyCount: number
  averageProgress: number
  createdAt: string
  words: LessonWordItem[]
}

export interface SetCurrentLessonPreview {
  lessonId: string
  lessonTitle: string
  nextLessonId: string | null
  nextLessonTitle: string | null
  wordsToAdd: number
  wordsAlreadyInDictionary: number
}

export interface TrainingReadiness {
  readyCount: number
  canStart: boolean
  missingByWord: Array<{
    wordId: string
    spanish: string
    russian: string
    missingFields: string[]
  }>
  trainerAvailable: false
}

export type DailyTrainerKind = 'daily' | 'extra'

export interface DailyTrainerWordItem {
  userCardId: string
  wordId: string
  spanish: string
  russian: string
  progress: number
}

export interface DailyTrainerItem {
  id: string
  kind: DailyTrainerKind
  slot: number
  sourceLabel: string
  wordCount: number
  words: DailyTrainerWordItem[]
}

export interface DailyTrainingTodayResponse {
  date: string
  readyCardCount: number
  trainers: DailyTrainerItem[]
}
