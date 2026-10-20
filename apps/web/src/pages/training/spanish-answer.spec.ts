import { describe, expect, it } from 'vitest'
import { compareSpanishAnswer } from './spanish-answer'

describe('compareSpanishAnswer', () => {
  it('accepts exact match ignoring case and extra spaces', () => {
    expect(compareSpanishAnswer('el gato', '  El   gato  ')).toEqual({
      correct: true,
    })
  })

  it('rejects n instead of ñ', () => {
    expect(compareSpanishAnswer('niño', 'nino')).toEqual({ correct: false })
  })

  it('accepts missing acute accents with a warning', () => {
    expect(compareSpanishAnswer('café', 'cafe')).toEqual({
      correct: true,
      accentWarning: 'café',
    })
  })

  it('accepts wrong acute placement with a warning when letters match', () => {
    expect(compareSpanishAnswer('médico', 'medíco')).toEqual({
      correct: true,
      accentWarning: 'médico',
    })
  })

  it('rejects other typos', () => {
    expect(compareSpanishAnswer('hola', 'halo')).toEqual({ correct: false })
  })

  it('rejects word reordering', () => {
    expect(compareSpanishAnswer('por favor', 'favor por')).toEqual({
      correct: false,
    })
  })

  it('requires the article when it is part of the Spanish text', () => {
    expect(compareSpanishAnswer('el libro', 'libro')).toEqual({
      correct: false,
    })
  })

  it('rejects empty answers', () => {
    expect(compareSpanishAnswer('hola', '   ')).toEqual({ correct: false })
  })
})
