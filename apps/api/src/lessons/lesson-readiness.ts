export function getMissingTrainerFields(word: {
  spanish: string
  russian: string
  wrongRussian: string[]
  wrongSpanish: string[]
}): string[] {
  const missing: string[] = []

  if (!word.spanish.trim()) {
    missing.push('spanish')
  }

  if (!word.russian.trim()) {
    missing.push('russian')
  }

  if (word.wrongRussian.length < 3) {
    missing.push('wrongRussian')
  }

  if (word.wrongSpanish.length < 3) {
    missing.push('wrongSpanish')
  }

  return missing
}

export function isWordReadyForTrainer(word: {
  spanish: string
  russian: string
  wrongRussian: string[]
  wrongSpanish: string[]
}): boolean {
  return getMissingTrainerFields(word).length === 0
}
