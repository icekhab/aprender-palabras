import { z } from 'zod'

export const loginSchema = z.object({
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
})

export type LoginInput = z.infer<typeof loginSchema>

export const userRoleSchema = z.enum(['user', 'teacher', 'admin'])

export type UserRole = z.infer<typeof userRoleSchema>

export interface AuthUser {
  id: string
  login: string
  role: UserRole
}

/** Limits for primary Spanish / Russian pair fields and suggestions `q`. */
export const SPANISH_MAX_CHARS = 100
export const SPANISH_MAX_WORDS = 10
export const RUSSIAN_MAX_CHARS = 120
export const WORD_FIELD_MIN_CHARS = 1

const CYRILLIC_RE = /\p{Script=Cyrillic}/u

export function hasCyrillic(text: string): boolean {
  return CYRILLIC_RE.test(text)
}

/** Word count after trim and collapsing whitespace. */
export function countWords(text: string): number {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (normalized === '') {
    return 0
  }
  return normalized.split(' ').length
}

export function isValidSpanishField(text: string): boolean {
  const trimmed = text.trim()
  return (
    trimmed.length >= WORD_FIELD_MIN_CHARS &&
    trimmed.length <= SPANISH_MAX_CHARS &&
    countWords(trimmed) <= SPANISH_MAX_WORDS
  )
}

export function isValidRussianField(text: string): boolean {
  const trimmed = text.trim()
  return (
    trimmed.length >= WORD_FIELD_MIN_CHARS &&
    trimmed.length <= RUSSIAN_MAX_CHARS
  )
}

function addSpanishFieldIssues(
  value: string,
  ctx: z.RefinementCtx,
  path: PropertyKey[] = [],
): void {
  if (value.length > SPANISH_MAX_CHARS) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Spanish text must be at most ${SPANISH_MAX_CHARS} characters`,
    })
  }
  if (countWords(value) > SPANISH_MAX_WORDS) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Spanish text must have at most ${SPANISH_MAX_WORDS} words`,
    })
  }
}

const spanishFieldSchema = z
  .string()
  .trim()
  .min(WORD_FIELD_MIN_CHARS)
  .superRefine((value, ctx) => {
    addSpanishFieldIssues(value, ctx)
  })

const russianFieldSchema = z
  .string()
  .trim()
  .min(WORD_FIELD_MIN_CHARS)
  .max(RUSSIAN_MAX_CHARS)

export const suggestionsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(WORD_FIELD_MIN_CHARS)
    .superRefine((value, ctx) => {
      if (hasCyrillic(value)) {
        if (value.length > RUSSIAN_MAX_CHARS) {
          ctx.addIssue({
            code: 'custom',
            message: `Query must be at most ${RUSSIAN_MAX_CHARS} characters`,
          })
        }
        return
      }
      addSpanishFieldIssues(value, ctx)
    }),
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
  spanish: spanishFieldSchema,
  russian: russianFieldSchema,
})

export type WordPairInput = z.infer<typeof wordPairSchema>

export const wordGenderSchema = z.enum(['masculine', 'feminine'])

export type WordGender = z.infer<typeof wordGenderSchema>

export const PART_OF_SPEECH_OPTIONS = [
  'verbo',
  'sustantivo',
  'adjetivo',
  'adverbio',
  'preposición',
  'conjunción',
  'pronombre',
  'interjección',
  'expresión',
] as const

export const partOfSpeechSchema = z.enum(PART_OF_SPEECH_OPTIONS)

export type PartOfSpeech = z.infer<typeof partOfSpeechSchema>

const imageFieldsSchema = {
  imageUrl: z.string().trim().url().nullable(),
  imagePhotographerName: z.string().trim().min(1).max(200).nullable(),
  imagePhotographerUrl: z.string().trim().url().nullable(),
  imagePageUrl: z.string().trim().url().nullable(),
  imageProvider: z.literal('unsplash').nullable(),
  imageDownloadLocation: z.string().trim().url().nullable(),
}

export const wordDraftSchema = z.object({
  spanish: spanishFieldSchema,
  russian: russianFieldSchema,
  additionalTranslations: z.array(z.string().trim().min(1).max(200)).max(10),
  definitionEs: z.string().trim().min(1).max(2000).nullable(),
  examples: z.array(z.string().trim().min(1).max(500)).max(3),
  partOfSpeech: z.string().trim().min(1).max(100).nullable(),
  gender: wordGenderSchema.nullable(),
  wrongRussian: z.array(z.string().trim().min(1).max(200)).max(10),
  wrongSpanish: z.array(z.string().trim().min(1).max(200)).max(10),
  ...imageFieldsSchema,
})

export type WordDraft = z.infer<typeof wordDraftSchema>

export const updateWordCardSchema = z
  .object({
    spanish: spanishFieldSchema,
    russian: russianFieldSchema,
    definitionEs: z.string().trim().min(1).max(2000),
    examples: z.array(z.string().trim().min(1).max(500)).min(2).max(3),
    partOfSpeech: partOfSpeechSchema,
    gender: wordGenderSchema.nullable(),
    wrongRussian: z.array(z.string().trim().min(1).max(200)).min(3).max(10),
    wrongSpanish: z.array(z.string().trim().min(1).max(200)).min(3).max(10),
    ...imageFieldsSchema,
  })
  .superRefine((value, ctx) => {
    if (value.partOfSpeech === 'sustantivo' && value.gender === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gender'],
        message: 'Gender is required for sustantivo',
      })
    }

    if (value.partOfSpeech !== 'sustantivo' && value.gender !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gender'],
        message: 'Gender is only allowed for sustantivo',
      })
    }

    const russianKey = value.russian.trim().toLocaleLowerCase()
    for (const [index, option] of value.wrongRussian.entries()) {
      if (option.trim().toLocaleLowerCase() === russianKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['wrongRussian', index],
          message: 'Must not match primary translation',
        })
      }
    }

    const spanishKey = value.spanish.trim().toLocaleLowerCase()
    for (const [index, option] of value.wrongSpanish.entries()) {
      if (option.trim().toLocaleLowerCase() === spanishKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['wrongSpanish', index],
          message: 'Must not match Spanish word',
        })
      }
    }
  })

export type UpdateWordCardInput = z.infer<typeof updateWordCardSchema>

export const regenerateWordImageSchema = z.object({
  spanish: spanishFieldSchema,
  russian: russianFieldSchema,
  wordId: z.string().uuid().optional(),
  excludeImageUrl: z.string().trim().url().optional(),
})

export type RegenerateWordImageInput = z.infer<typeof regenerateWordImageSchema>

export interface RegeneratedWordImage {
  imageUrl: string
  imagePhotographerName: string
  imagePhotographerUrl: string
  imagePageUrl: string
  imageProvider: 'unsplash'
  imageDownloadLocation: string
}

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
  q: z
    .string()
    .max(100)
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined
      }

      const trimmed = value.trim()
      return trimmed === '' ? undefined : trimmed
    }),
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

export type UserCardSource = 'manual' | 'lesson'

export interface UserCardLessonRef {
  id: string
  title: string
}

export interface UserCardDetail {
  id: string
  wordId: string
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
  progress: number
  inDictionary: boolean
  source: UserCardSource
  addedAt: string
  ready: boolean
  missingFields: string[]
  canEdit: boolean
  lessons: UserCardLessonRef[]
}

export const adminWordsSortBySchema = z.enum(['updatedAt', 'createdAt'])

export type AdminWordsSortBy = z.infer<typeof adminWordsSortBySchema>

export const adminWordsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: adminWordsSortBySchema.default('updatedAt'),
  q: z
    .string()
    .max(100)
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined
      }

      const trimmed = value.trim()
      return trimmed === '' ? undefined : trimmed
    }),
})

export type AdminWordsListQuery = z.infer<typeof adminWordsListQuerySchema>

export interface AdminWordListItem {
  id: string
  spanish: string
  russian: string
  createdAt: string
  updatedAt: string
}

export interface AdminWordsListResponse {
  totalCount: number
  hasMore: boolean
  items: AdminWordListItem[]
}

export interface AdminWordDetail {
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
  userCardId: string | null
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

export interface TrainerSessionWord {
  userCardId: string
  wordId: string
  completedTrainerCount: number
  showIntro: boolean
  progress: number
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
}

export interface TrainerSessionResponse {
  id: string
  kind: DailyTrainerKind
  slot: number
  sourceLabel: string
  words: TrainerSessionWord[]
}

export interface CompleteTrainerCardInput {
  userCardId: string
  errorCount: number
}

export interface CompleteTrainerRequest {
  cards: CompleteTrainerCardInput[]
  /** Client clock when the session became ready (ISO). Soft-accepted by the API. */
  startedAt?: string
  /** Client clock when complete was submitted (ISO). Soft-accepted by the API. */
  completedAt?: string
}

export interface CompleteTrainerCardResult {
  userCardId: string
  spanish: string
  russian: string
  errorCount: number
  oldProgress: number
  delta: number
  newProgress: number
}

export interface CompleteTrainerResponse {
  cards: CompleteTrainerCardResult[]
  /** Words practiced in this trainer. */
  wordCount: number
  /** Daily (non-extra) trainers in the day. */
  dailyTotal: number
  /** Daily trainers with status completed after this save. */
  dailyCompleted: number
  /** Next open trainer for Continuar, or null when the day has none left. */
  nextTrainerId: string | null
}
