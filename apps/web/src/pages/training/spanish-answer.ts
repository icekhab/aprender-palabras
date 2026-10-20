export type SpanishAnswerResult =
  | { correct: true; accentWarning?: string }
  | { correct: false }

/** Trim and collapse internal whitespace. */
export function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Strip Spanish acute accents (áéíóú) only. Keeps ñ and other characters.
 * Used so missing/wrong stress can still match with a warning (§8).
 */
export function stripAcuteAccents(value: string): string {
  return value
    .replaceAll('á', 'a')
    .replaceAll('é', 'e')
    .replaceAll('í', 'i')
    .replaceAll('ó', 'o')
    .replaceAll('ú', 'u')
    .replaceAll('Á', 'A')
    .replaceAll('É', 'E')
    .replaceAll('Í', 'I')
    .replaceAll('Ó', 'O')
    .replaceAll('Ú', 'U')
}

/**
 * Compare typed Spanish to the expected card text (product §8).
 * Empty input should be blocked in the UI before calling this.
 */
export function compareSpanishAnswer(
  expected: string,
  actual: string,
): SpanishAnswerResult {
  const expectedNorm = normalizeSpaces(expected).toLocaleLowerCase('es')
  const actualNorm = normalizeSpaces(actual).toLocaleLowerCase('es')

  if (actualNorm.length === 0) {
    return { correct: false }
  }

  if (actualNorm === expectedNorm) {
    return { correct: true }
  }

  if (stripAcuteAccents(actualNorm) === stripAcuteAccents(expectedNorm)) {
    return { correct: true, accentWarning: expected }
  }

  return { correct: false }
}
