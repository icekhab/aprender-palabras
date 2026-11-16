import type { CsvWordImportRow } from './csv-word-import'

export type CsvWordImportTarget =
  | { kind: 'catalog' }
  | { kind: 'collection'; collectionId: string }

export type CsvWordImportSession = {
  target: CsvWordImportTarget
  rows: CsvWordImportRow[]
  index: number
}

const STORAGE_KEY = 'aprender-palabras:admin-csv-word-import'

/**
 * In-flight / completed work per import step. Survives React Strict Mode
 * remounts so we do not double-POST or skip advance.
 */
const stepWork = new Map<string, Promise<void>>()

export function saveCsvWordImportSession(session: CsvWordImportSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function readCsvWordImportSession(): CsvWordImportSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as CsvWordImportSession
    if (
      !parsed ||
      !Array.isArray(parsed.rows) ||
      typeof parsed.index !== 'number' ||
      !parsed.target
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function clearCsvWordImportSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
  stepWork.clear()
}

export function importStepKey(session: CsvWordImportSession): string {
  const targetKey =
    session.target.kind === 'collection'
      ? `collection:${session.target.collectionId}`
      : 'catalog'
  const row = session.rows[session.index]
  return `${targetKey}|${session.index}|${row?.spanish ?? ''}|${row?.russian ?? ''}`
}

/** Runs `work` once per step key; concurrent callers share the same promise. */
export function runImportStepOnce(
  stepKey: string,
  work: () => Promise<void>,
): Promise<void> {
  const existing = stepWork.get(stepKey)
  if (existing) {
    return existing
  }

  const pending = work()
  stepWork.set(stepKey, pending)
  return pending
}

export function importReturnPath(target: CsvWordImportTarget): string {
  if (target.kind === 'collection') {
    return `/colecciones/${target.collectionId}`
  }

  return '/admin/words'
}
