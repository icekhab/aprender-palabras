import { describe, expect, it } from 'vitest'
import { normalizeSearchKey } from '../words/word-normalize.js'
import {
  compareDbSuggestionPhrases,
  matchesWordPrefixInPair,
  matchesWordPrefixQuery,
  rankDbSuggestionMatches,
  splitWords,
} from './word-prefix-match.js'

describe('splitWords', () => {
  it('splits on whitespace and trims', () => {
    expect(splitWords('  el   coche ')).toEqual(['el', 'coche'])
    expect(splitWords('')).toEqual([])
  })
})

describe('matchesWordPrefixQuery', () => {
  it('matches prefix at the start of a word, not mid-word', () => {
    expect(matchesWordPrefixQuery('sentir', 'sentir')).toBe(true)
    expect(matchesWordPrefixQuery('sentir', 'consentir')).toBe(false)
    expect(matchesWordPrefixQuery('coche', 'el coche')).toBe(true)
    expect(matchesWordPrefixQuery('coc', 'el coche')).toBe(true)
  })

  it('matches multi-token queries as a consecutive window', () => {
    expect(matchesWordPrefixQuery('el coc', 'el coche')).toBe(true)
    expect(matchesWordPrefixQuery('el coc', 'coche el')).toBe(false)
    expect(matchesWordPrefixQuery('ir a cas', 'ir a casa')).toBe(true)
  })
})

describe('matchesWordPrefixInPair', () => {
  it('matches either spanish or russian search keys', () => {
    expect(
      matchesWordPrefixInPair('ждать', 'esperar', 'ждать'),
    ).toBe(true)
    expect(
      matchesWordPrefixInPair('esp', 'esperar', 'ждать'),
    ).toBe(true)
    expect(
      matchesWordPrefixInPair('zzz', 'esperar', 'ждать'),
    ).toBe(false)
  })
})

describe('rankDbSuggestionMatches', () => {
  it('prefers fewer words on the query-language side', () => {
    const ranked = rankDbSuggestionMatches(
      'coche',
      [
        {
          spanish: 'el coche',
          russian: 'машина',
          searchSpanish: 'el coche',
          searchRussian: 'машина',
        },
        {
          spanish: 'coche',
          russian: 'автомобиль',
          searchSpanish: 'coche',
          searchRussian: 'автомобиль',
        },
        {
          spanish: 'consentir',
          russian: 'соглашаться',
          searchSpanish: 'consentir',
          searchRussian: 'соглашаться',
        },
      ],
      'es-to-ru',
    )

    expect(ranked.map((item) => item.spanish)).toEqual(['coche', 'el coche'])
  })

  it('matches accent-folded query against accent-folded search keys', () => {
    const ranked = rankDbSuggestionMatches(
      normalizeSearchKey('cárc'),
      [
        {
          spanish: 'cárcel',
          russian: 'тюрьма',
          searchSpanish: normalizeSearchKey('cárcel'),
          searchRussian: normalizeSearchKey('тюрьма'),
        },
        {
          spanish: 'carro',
          russian: 'телега',
          searchSpanish: 'carro',
          searchRussian: normalizeSearchKey('телега'),
        },
      ],
      'es-to-ru',
    )

    expect(ranked.map((item) => item.spanish)).toEqual(['cárcel'])
  })

  it('uses russian word count for ru-to-es', () => {
    const ranked = rankDbSuggestionMatches(
      'маш',
      [
        {
          spanish: 'el coche',
          russian: 'машина легковая',
          searchSpanish: 'el coche',
          searchRussian: 'машина легковая',
        },
        {
          spanish: 'coche',
          russian: 'машина',
          searchSpanish: 'coche',
          searchRussian: 'машина',
        },
      ],
      'ru-to-es',
    )

    expect(ranked.map((item) => item.russian)).toEqual([
      'машина',
      'машина легковая',
    ])
  })
})

describe('compareDbSuggestionPhrases', () => {
  it('breaks ties by spanish ASC', () => {
    expect(
      compareDbSuggestionPhrases(
        { spanish: 'barco', russian: 'лодка' },
        { spanish: 'casa', russian: 'дом' },
        'es-to-ru',
      ),
    ).toBeLessThan(0)
  })
})
