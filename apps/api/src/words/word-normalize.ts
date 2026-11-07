/** Uniqueness key: trim, collapse spaces, lowercase. Keeps ñ/accents. */
export function normalizeWordKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

/**
 * Search key: same as normalizeWordKey, then strip diacritics (NFD) and map ё→е.
 * Used for Word.searchSpanish/searchRussian and for folding suggestion queries.
 * Example: "cárcel" → "carcel", "niño" → "nino", "ёж" → "еж".
 */
export function normalizeSearchKey(value: string): string {
  return normalizeWordKey(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ё', 'е')
}
