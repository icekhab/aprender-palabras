import { describe, expect, it } from 'vitest'
import { normalizeWordKey } from './word-normalize.js'

describe('normalizeWordKey', () => {
  it('trims and collapses whitespace and lowercases', () => {
    expect(normalizeWordKey('  Esperar  ahora  ')).toBe('esperar ahora')
  })

  it('keeps ñ distinct from n', () => {
    expect(normalizeWordKey('niño')).toBe('niño')
    expect(normalizeWordKey('niño')).not.toBe(normalizeWordKey('nino'))
  })
})
