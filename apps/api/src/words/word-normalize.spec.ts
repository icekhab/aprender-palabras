import { describe, expect, it } from 'vitest'
import { normalizeSearchKey, normalizeWordKey } from './word-normalize.js'

describe('normalizeWordKey', () => {
  it('trims and collapses whitespace and lowercases', () => {
    expect(normalizeWordKey('  Esperar  ahora  ')).toBe('esperar ahora')
  })

  it('keeps ñ distinct from n', () => {
    expect(normalizeWordKey('niño')).toBe('niño')
    expect(normalizeWordKey('niño')).not.toBe(normalizeWordKey('nino'))
  })
})

describe('normalizeSearchKey', () => {
  it('strips Spanish diacritics', () => {
    expect(normalizeSearchKey('cárcel')).toBe('carcel')
    expect(normalizeSearchKey('Cárc')).toBe('carc')
    expect(normalizeSearchKey('niño')).toBe('nino')
  })

  it('maps ё to е', () => {
    expect(normalizeSearchKey('ёж')).toBe('еж')
  })

  it('trims and collapses whitespace', () => {
    expect(normalizeSearchKey('  El  Cárcel  ')).toBe('el carcel')
  })
})
