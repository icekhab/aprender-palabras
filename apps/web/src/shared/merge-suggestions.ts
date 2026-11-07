import type { SuggestionItem } from '@aprender-palabras/contracts'

function pairKey(item: SuggestionItem): string {
  return `${normalizePairPart(item.spanish)}\0${normalizePairPart(item.russian)}`
}

function normalizePairPart(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

/** Keep DB order; append AI-only pairs. Matching pairs stay as DB rows. */
export function mergeSuggestions(
  dbSuggestions: SuggestionItem[],
  aiSuggestions: SuggestionItem[],
): SuggestionItem[] {
  const seen = new Set(dbSuggestions.map(pairKey))
  const merged = [...dbSuggestions]

  for (const item of aiSuggestions) {
    const key = pairKey(item)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(item)
  }

  return merged
}
