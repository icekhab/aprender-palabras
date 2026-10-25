import { describe, expect, it } from 'vitest'
import { ApiError } from './api/auth'
import {
  getSuggestionsFetchErrorCopy,
  getSuggestionsQueryError,
} from './suggestions-query'

describe('getSuggestionsQueryError', () => {
  it('rejects Spanish queries with more than 10 words', () => {
    const query = 'uno dos tres cuatro cinco seis siete ocho nueve diez once'
    expect(getSuggestionsQueryError(query)).toBe(
      'Máximo 10 palabras en español.',
    )
  })

  it('allows up to 10 Spanish words', () => {
    const query = 'uno dos tres cuatro cinco seis siete ocho nueve diez'
    expect(getSuggestionsQueryError(query)).toBeNull()
  })

  it('rejects oversized Russian queries', () => {
    expect(getSuggestionsQueryError('ж'.repeat(121))).toBe(
      'Máximo 120 caracteres en ruso.',
    )
  })
})

describe('getSuggestionsFetchErrorCopy', () => {
  it('includes the exhausted suggestions limit', () => {
    expect(
      getSuggestionsFetchErrorCopy(
        new ApiError('Daily quota exceeded', 429, {
          code: 'SUGGESTIONS_QUOTA_EXCEEDED',
          limit: 10,
        }),
      ),
    ).toEqual({
      title: 'Límite diario de sugerencias agotado',
      description: 'Puedes pedir hasta 10 sugerencias al día.',
    })
  })

  it('maps unavailable status', () => {
    expect(
      getSuggestionsFetchErrorCopy(new ApiError('down', 503)),
    ).toEqual({ title: 'Las sugerencias no están disponibles.' })
  })
})
