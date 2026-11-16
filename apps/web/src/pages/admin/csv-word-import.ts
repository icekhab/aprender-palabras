import {
  CSV_WORD_IMPORT_MAX_ROWS,
  PART_OF_SPEECH_OPTIONS,
  RUSSIAN_MAX_CHARS,
  SPANISH_MAX_CHARS,
  SPANISH_MAX_WORDS,
  wordGenderSchema,
  type PartOfSpeech,
  type WordDraft,
  type WordGender,
} from '@aprender-palabras/contracts'

export const CSV_WORD_IMPORT_HEADERS = [
  'spanish',
  'russian',
  'definitionEs',
  'examples',
  'partOfSpeech',
  'gender',
  'wrongRussian',
  'wrongSpanish',
  'unsplashQuery',
] as const

export type CsvWordImportHeader = (typeof CSV_WORD_IMPORT_HEADERS)[number]

export type CsvWordImportRow = {
  spanish: string
  russian: string
  definitionEs: string | null
  examples: string[] | null
  partOfSpeech: PartOfSpeech | null
  gender: WordGender | null
  wrongRussian: string[] | null
  wrongSpanish: string[] | null
  /** English Unsplash search phrase; skips OpenAI query generation when set. */
  unsplashQuery: string | null
}

export type CsvWordImportRowError = {
  line: number
  message: string
}

export type CsvWordImportParseResult = {
  rows: CsvWordImportRow[]
  errors: CsvWordImportRowError[]
}

const LIST_SEPARATOR = '|'
const PART_OF_SPEECH_SET = new Set<string>(PART_OF_SPEECH_OPTIONS)

/** Same uniqueness key as API `normalizeWordKey`. */
export function normalizeImportPairKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

export function pairKey(spanish: string, russian: string): string {
  return `${normalizeImportPairKey(spanish)}|${normalizeImportPairKey(russian)}`
}

export const CSV_WORD_IMPORT_TEMPLATE = [
  CSV_WORD_IMPORT_HEADERS.join(','),
  'el libro,книга,,,sustantivo,masculine,,,hardcover book on table',
  'esperar,ждать,"aguardar la llegada","Espero el bus.|Espero noticias.",verbo,,ждать впустую|надеяться|терпеть,esperar a|aguardar|demorar,person waiting at bus stop',
].join('\n')

export function parseCsvWordImport(text: string): CsvWordImportParseResult {
  const matrix = parseCsvMatrix(text)
  if (matrix.length === 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'El archivo CSV está vacío.' }],
    }
  }

  const headerCells = matrix[0].map((cell) => cell.trim())
  const headerError = validateHeaders(headerCells)
  if (headerError) {
    return { rows: [], errors: [{ line: 1, message: headerError }] }
  }

  const columnIndex = Object.fromEntries(
    CSV_WORD_IMPORT_HEADERS.map((name) => [name, headerCells.indexOf(name)]),
  ) as Record<CsvWordImportHeader, number>

  const rows: CsvWordImportRow[] = []
  const errors: CsvWordImportRowError[] = []
  const seenKeys = new Set<string>()

  for (let i = 1; i < matrix.length; i += 1) {
    const line = i + 1
    const cells = matrix[i]
    if (cells.every((cell) => cell.trim() === '')) {
      continue
    }

    const rawSpanish = readCell(cells, columnIndex.spanish)
    const rawRussian = readCell(cells, columnIndex.russian)
    const parsed = parseRowFields({
      spanish: rawSpanish,
      russian: rawRussian,
      definitionEs: readCell(cells, columnIndex.definitionEs),
      examples: readCell(cells, columnIndex.examples),
      partOfSpeech: readCell(cells, columnIndex.partOfSpeech),
      gender: readCell(cells, columnIndex.gender),
      wrongRussian: readCell(cells, columnIndex.wrongRussian),
      wrongSpanish: readCell(cells, columnIndex.wrongSpanish),
      unsplashQuery: readCell(cells, columnIndex.unsplashQuery),
    })

    if (parsed.error) {
      errors.push({ line, message: parsed.error })
      continue
    }

    const key = pairKey(parsed.row.spanish, parsed.row.russian)
    if (seenKeys.has(key)) {
      errors.push({
        line,
        message: 'Pareja duplicada en el archivo.',
      })
      continue
    }

    seenKeys.add(key)
    rows.push(parsed.row)
  }

  if (rows.length > CSV_WORD_IMPORT_MAX_ROWS) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Máximo ${CSV_WORD_IMPORT_MAX_ROWS} filas válidas por importación.`,
        },
      ],
    }
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 1, message: 'No hay filas de datos en el CSV.' })
  }

  return { rows, errors }
}

export function mergeCsvRowOverDraft(
  row: CsvWordImportRow,
  draft: WordDraft,
): WordDraft {
  return {
    ...draft,
    spanish: row.spanish,
    russian: row.russian,
    definitionEs: row.definitionEs ?? draft.definitionEs,
    examples: row.examples ?? draft.examples,
    partOfSpeech: row.partOfSpeech ?? draft.partOfSpeech,
    gender:
      (row.partOfSpeech ?? draft.partOfSpeech) === 'sustantivo'
        ? (row.gender ?? draft.gender)
        : null,
    wrongRussian: row.wrongRussian ?? draft.wrongRussian,
    wrongSpanish: row.wrongSpanish ?? draft.wrongSpanish,
    unsplashQuery: row.unsplashQuery ?? draft.unsplashQuery,
  }
}

export function csvRowToEmptyDraft(row: CsvWordImportRow): WordDraft {
  return {
    spanish: row.spanish,
    russian: row.russian,
    additionalTranslations: [],
    definitionEs: row.definitionEs,
    examples: row.examples ?? [],
    partOfSpeech: row.partOfSpeech,
    gender: row.partOfSpeech === 'sustantivo' ? row.gender : null,
    wrongRussian: row.wrongRussian ?? [],
    wrongSpanish: row.wrongSpanish ?? [],
    imageUrl: null,
    imagePhotographerName: null,
    imagePhotographerUrl: null,
    imagePageUrl: null,
    imageProvider: null,
    imageDownloadLocation: null,
    imageCandidates: [],
    unsplashQuery: row.unsplashQuery,
  }
}

/** True when CSV already has all text fields needed to save without content AI. */
export function csvRowHasCompleteContent(row: CsvWordImportRow): boolean {
  if (!row.definitionEs || !row.partOfSpeech) {
    return false
  }
  if (!row.examples || row.examples.length < 2) {
    return false
  }
  if (!row.wrongRussian || row.wrongRussian.length < 3) {
    return false
  }
  if (!row.wrongSpanish || row.wrongSpanish.length < 3) {
    return false
  }
  if (row.partOfSpeech === 'sustantivo' && !row.gender) {
    return false
  }
  return true
}

function validateHeaders(headerCells: string[]): string | null {
  const missing = CSV_WORD_IMPORT_HEADERS.filter(
    (name) => !headerCells.includes(name),
  )
  if (missing.length > 0) {
    return `Faltan columnas: ${missing.join(', ')}.`
  }

  return null
}

function readCell(cells: string[], index: number): string {
  if (index < 0 || index >= cells.length) {
    return ''
  }

  return cells[index] ?? ''
}

function parseRowFields(raw: Record<CsvWordImportHeader, string>): {
  row: CsvWordImportRow
  error: string | null
} {
  const spanish = raw.spanish.replace(/\s+/g, ' ').trim()
  const russian = raw.russian.replace(/\s+/g, ' ').trim()

  if (!spanish || !russian) {
    return {
      row: emptyRow(),
      error: 'spanish y russian son obligatorios.',
    }
  }

  if (spanish.length > SPANISH_MAX_CHARS) {
    return {
      row: emptyRow(),
      error: `spanish supera ${SPANISH_MAX_CHARS} caracteres.`,
    }
  }

  if (countWords(spanish) > SPANISH_MAX_WORDS) {
    return {
      row: emptyRow(),
      error: `spanish supera ${SPANISH_MAX_WORDS} palabras.`,
    }
  }

  if (russian.length > RUSSIAN_MAX_CHARS) {
    return {
      row: emptyRow(),
      error: `russian supera ${RUSSIAN_MAX_CHARS} caracteres.`,
    }
  }

  const definitionEs = optionalText(raw.definitionEs)
  const examples = optionalList(raw.examples)
  if (examples && (examples.length < 2 || examples.length > 3)) {
    return {
      row: emptyRow(),
      error: 'examples debe tener 2 o 3 frases separadas por |.',
    }
  }

  const partOfSpeechRaw = optionalText(raw.partOfSpeech)
  let partOfSpeech: PartOfSpeech | null = null
  if (partOfSpeechRaw) {
    if (!PART_OF_SPEECH_SET.has(partOfSpeechRaw)) {
      return {
        row: emptyRow(),
        error: `partOfSpeech inválido: ${partOfSpeechRaw}.`,
      }
    }
    partOfSpeech = partOfSpeechRaw as PartOfSpeech
  }

  const genderRaw = optionalText(raw.gender)
  let gender: WordGender | null = null
  if (genderRaw) {
    const genderResult = wordGenderSchema.safeParse(genderRaw)
    if (!genderResult.success) {
      return {
        row: emptyRow(),
        error: 'gender debe ser masculine o feminine.',
      }
    }
    gender = genderResult.data
  }

  if (gender && partOfSpeech && partOfSpeech !== 'sustantivo') {
    return {
      row: emptyRow(),
      error: 'gender solo es válido con partOfSpeech=sustantivo.',
    }
  }

  if (gender && !partOfSpeech) {
    return {
      row: emptyRow(),
      error: 'gender requiere partOfSpeech=sustantivo.',
    }
  }

  const wrongRussian = optionalList(raw.wrongRussian)
  if (wrongRussian && (wrongRussian.length < 3 || wrongRussian.length > 10)) {
    return {
      row: emptyRow(),
      error: 'wrongRussian debe tener 3–10 valores separados por |.',
    }
  }

  const wrongSpanish = optionalList(raw.wrongSpanish)
  if (wrongSpanish && (wrongSpanish.length < 3 || wrongSpanish.length > 10)) {
    return {
      row: emptyRow(),
      error: 'wrongSpanish debe tener 3–10 valores separados por |.',
    }
  }

  const unsplashQueryRaw = optionalText(raw.unsplashQuery)
  let unsplashQuery: string | null = null
  if (unsplashQueryRaw) {
    if (unsplashQueryRaw.length > 200) {
      return {
        row: emptyRow(),
        error: 'unsplashQuery supera 200 caracteres.',
      }
    }
    unsplashQuery = unsplashQueryRaw
  }

  return {
    row: {
      spanish,
      russian,
      definitionEs,
      examples,
      partOfSpeech,
      gender: partOfSpeech === 'sustantivo' ? gender : null,
      wrongRussian,
      wrongSpanish,
      unsplashQuery,
    },
    error: null,
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function optionalList(value: string): string[] | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }

  const items = trimmed
    .split(LIST_SEPARATOR)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0)

  return items.length > 0 ? items : null
}

function countWords(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) {
    return 0
  }

  return trimmed.split(/\s+/).length
}

function emptyRow(): CsvWordImportRow {
  return {
    spanish: '',
    russian: '',
    definitionEs: null,
    examples: null,
    partOfSpeech: null,
    gender: null,
    wrongRussian: null,
    wrongSpanish: null,
    unsplashQuery: null,
  }
}

/** Minimal RFC 4180 CSV matrix parser (comma, quotes, CRLF/LF). */
export function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    if (char === '\r') {
      if (next === '\n') {
        continue
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (inQuotes) {
    return []
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}
