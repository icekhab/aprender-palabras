const STORAGE_KEY = 'aprender-palabras:skip-speak-exercises'

/** Opt-out survives Continuar to the next trainer; cleared when returning home. */
export function readSkipSpeakExercises(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSkipSpeakExercises(skip: boolean): void {
  try {
    if (skip) {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Private mode / blocked storage — in-memory flag still applies this run.
  }
}

export function clearSkipSpeakExercises(): void {
  writeSkipSpeakExercises(false)
}
