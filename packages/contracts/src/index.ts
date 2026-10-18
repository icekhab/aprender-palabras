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
