import { countWords } from '@aprender-palabras/contracts'

const DB_SUGGESTIONS_LIMIT = 20

/** Split on whitespace; empty input → []. */
export function splitWords(text: string): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (normalized === '') {
    return []
  }
  return normalized.split(' ')
}

/**
 * Word-boundary prefix match: each query token must be a prefix of a
 * consecutive window of words in `text`.
 * Caller should pass accent-folded strings (normalizeSearchKey) for both sides.
 * "sentir" matches "sentir", not "consentir"; "coche" matches "el coche".
 */
export function matchesWordPrefixQuery(query: string, text: string): boolean {
  const queryWords = splitWords(query)
  if (queryWords.length === 0) {
    return false
  }

  const fieldWords = splitWords(text)
  if (fieldWords.length < queryWords.length) {
    return false
  }

  for (let i = 0; i <= fieldWords.length - queryWords.length; i += 1) {
    const matchesWindow = queryWords.every((token, offset) =>
      fieldWords[i + offset]!.startsWith(token),
    )
    if (matchesWindow) {
      return true
    }
  }

  return false
}

export function matchesWordPrefixInPair(
  searchQuery: string,
  searchSpanish: string,
  searchRussian: string,
): boolean {
  return (
    matchesWordPrefixQuery(searchQuery, searchSpanish) ||
    matchesWordPrefixQuery(searchQuery, searchRussian)
  )
}

/** Fewer words on the query-language side rank higher; then spanish ASC. */
export function compareDbSuggestionPhrases(
  a: { spanish: string; russian: string },
  b: { spanish: string; russian: string },
  direction: 'es-to-ru' | 'ru-to-es',
): number {
  const countA =
    direction === 'ru-to-es' ? countWords(a.russian) : countWords(a.spanish)
  const countB =
    direction === 'ru-to-es' ? countWords(b.russian) : countWords(b.spanish)
  if (countA !== countB) {
    return countA - countB
  }
  return a.spanish.localeCompare(b.spanish, 'es', { sensitivity: 'base' })
}

export function rankDbSuggestionMatches<
  T extends {
    spanish: string
    russian: string
    searchSpanish: string
    searchRussian: string
  },
>(
  searchQuery: string,
  candidates: T[],
  direction: 'es-to-ru' | 'ru-to-es',
  limit: number = DB_SUGGESTIONS_LIMIT,
): T[] {
  return candidates
    .filter((item) =>
      matchesWordPrefixInPair(
        searchQuery,
        item.searchSpanish,
        item.searchRussian,
      ),
    )
    .sort((a, b) => compareDbSuggestionPhrases(a, b, direction))
    .slice(0, limit)
}

export { DB_SUGGESTIONS_LIMIT }
