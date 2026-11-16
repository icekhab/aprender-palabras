import { describe, expect, it } from 'vitest'
import {
  CSV_WORD_IMPORT_TEMPLATE,
  csvRowHasCompleteContent,
  csvRowToEmptyDraft,
  mergeCsvRowOverDraft,
  parseCsvWordImport,
  type CsvWordImportRow,
} from './csv-word-import'
import type { WordDraft } from '@aprender-palabras/contracts'

const HEADER =
  'spanish,russian,definitionEs,examples,partOfSpeech,gender,wrongRussian,wrongSpanish,unsplashQuery'

const baseDraft = (): WordDraft => ({
  spanish: 'ai',
  russian: 'ai',
  additionalTranslations: [],
  definitionEs: 'AI def',
  examples: ['Ejemplo uno.', 'Ejemplo dos.'],
  partOfSpeech: 'verbo',
  gender: null,
  wrongRussian: ['a', 'b', 'c'],
  wrongSpanish: ['x', 'y', 'z'],
  imageUrl: 'https://images.unsplash.com/photo.jpg',
  imagePhotographerName: 'Ada',
  imagePhotographerUrl: 'https://unsplash.com/@ada',
  imagePageUrl: 'https://unsplash.com/photos/abc',
  imageProvider: 'unsplash',
  imageDownloadLocation: 'https://api.unsplash.com/photos/abc/download',
  imageCandidates: [],
  unsplashQuery: 'waiting person',
})

describe('parseCsvWordImport', () => {
  it('parses the downloadable template', () => {
    const result = parseCsvWordImport(CSV_WORD_IMPORT_TEMPLATE)

    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      spanish: 'el libro',
      russian: 'книга',
      partOfSpeech: 'sustantivo',
      gender: 'masculine',
      definitionEs: null,
      examples: null,
      unsplashQuery: 'hardcover book on table',
    })
    expect(result.rows[1].examples).toEqual([
      'Espero el bus.',
      'Espero noticias.',
    ])
    expect(result.rows[1].unsplashQuery).toBe('person waiting at bus stop')
  })

  it('rejects duplicate pairs inside the file', () => {
    const csv = [
      HEADER,
      'esperar,ждать,,,,,,,',
      'Esperar,Ждать,,,,,,,',
    ].join('\n')

    const result = parseCsvWordImport(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual([
      { line: 3, message: 'Pareja duplicada en el archivo.' },
    ])
  })

  it('rejects more than 50 valid rows', () => {
    const lines = [HEADER]
    for (let i = 0; i < 51; i += 1) {
      lines.push(`palabra${i},слово${i},,,,,,,`)
    }

    const result = parseCsvWordImport(lines.join('\n'))
    expect(result.rows).toEqual([])
    expect(result.errors[0]?.message).toContain('Máximo 50')
  })
})

describe('mergeCsvRowOverDraft', () => {
  it('keeps AI values when CSV optional fields are empty', () => {
    const row: CsvWordImportRow = {
      spanish: 'esperar',
      russian: 'ждать',
      definitionEs: null,
      examples: null,
      partOfSpeech: null,
      gender: null,
      wrongRussian: null,
      wrongSpanish: null,
      unsplashQuery: null,
    }

    const merged = mergeCsvRowOverDraft(row, baseDraft())
    expect(merged.definitionEs).toBe('AI def')
    expect(merged.imageUrl).toBe('https://images.unsplash.com/photo.jpg')
    expect(merged.spanish).toBe('esperar')
    expect(merged.unsplashQuery).toBe('waiting person')
  })

  it('overrides AI fields when CSV provides them', () => {
    const row: CsvWordImportRow = {
      spanish: 'el libro',
      russian: 'книга',
      definitionEs: 'CSV def',
      examples: ['Uno.', 'Dos.'],
      partOfSpeech: 'sustantivo',
      gender: 'masculine',
      wrongRussian: ['a', 'b', 'c'],
      wrongSpanish: ['x', 'y', 'z'],
      unsplashQuery: 'book on table',
    }

    const merged = mergeCsvRowOverDraft(row, baseDraft())
    expect(merged.definitionEs).toBe('CSV def')
    expect(merged.partOfSpeech).toBe('sustantivo')
    expect(merged.gender).toBe('masculine')
    expect(merged.imageUrl).toBe('https://images.unsplash.com/photo.jpg')
    expect(merged.unsplashQuery).toBe('book on table')
  })
})

describe('csvRowHasCompleteContent', () => {
  it('requires all save fields', () => {
    expect(
      csvRowHasCompleteContent({
        spanish: 'blanco',
        russian: 'белый',
        definitionEs: 'De color blanco',
        examples: ['Uno.', 'Dos.'],
        partOfSpeech: 'adjetivo',
        gender: null,
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
        unsplashQuery: 'white color',
      }),
    ).toBe(true)

    expect(
      csvRowHasCompleteContent({
        spanish: 'blanco',
        russian: 'белый',
        definitionEs: null,
        examples: ['Uno.', 'Dos.'],
        partOfSpeech: 'adjetivo',
        gender: null,
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
        unsplashQuery: null,
      }),
    ).toBe(false)
  })
})

describe('csvRowToEmptyDraft', () => {
  it('builds a draft without images but keeps unsplashQuery', () => {
    const draft = csvRowToEmptyDraft({
      spanish: 'hola',
      russian: 'привет',
      definitionEs: 'saludo',
      examples: null,
      partOfSpeech: null,
      gender: null,
      wrongRussian: null,
      wrongSpanish: null,
      unsplashQuery: 'hello greeting',
    })

    expect(draft.imageUrl).toBeNull()
    expect(draft.definitionEs).toBe('saludo')
    expect(draft.examples).toEqual([])
    expect(draft.unsplashQuery).toBe('hello greeting')
  })
})
