import {
  countWords,
  hasCyrillic,
  RUSSIAN_MAX_CHARS,
  SPANISH_MAX_CHARS,
  SPANISH_MAX_WORDS,
} from '@aprender-palabras/contracts'
import { ApiError, isSuggestionsQuotaError } from './api/auth'

/** Client-side field limits for suggestions `q`. Null = ok. */
export function getSuggestionsQueryError(query: string): string | null {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return null
  }

  if (hasCyrillic(trimmed)) {
    if (trimmed.length > RUSSIAN_MAX_CHARS) {
      return `Máximo ${RUSSIAN_MAX_CHARS} caracteres en ruso.`
    }
    return null
  }

  if (countWords(trimmed) > SPANISH_MAX_WORDS) {
    return `Máximo ${SPANISH_MAX_WORDS} palabras en español.`
  }
  if (trimmed.length > SPANISH_MAX_CHARS) {
    return `Máximo ${SPANISH_MAX_CHARS} caracteres en español.`
  }
  return null
}

export type SuggestionsFetchErrorCopy = {
  title: string
  description?: string
}

export function getSuggestionsFetchErrorCopy(
  error: unknown,
): SuggestionsFetchErrorCopy {
  if (isSuggestionsQuotaError(error) && error.limit !== null) {
    return {
      title: 'Límite diario de sugerencias agotado',
      description: `Puedes pedir hasta ${error.limit} sugerencias al día.`,
    }
  }

  if (error instanceof ApiError) {
    if (error.status === 503) {
      return { title: 'Las sugerencias no están disponibles.' }
    }
    if (error.status === 429) {
      return { title: 'Has alcanzado el límite diario de sugerencias.' }
    }
  }

  return { title: 'No se pudieron cargar las sugerencias.' }
}

/** @deprecated Prefer getSuggestionsFetchErrorCopy for title/description. */
export function getSuggestionsFetchErrorMessage(error: unknown): string {
  const copy = getSuggestionsFetchErrorCopy(error)
  return copy.description
    ? `${copy.title} ${copy.description}`
    : copy.title
}
