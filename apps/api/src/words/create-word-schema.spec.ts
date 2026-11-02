import { createWordSchema, updateWordCardSchema } from '@aprender-palabras/contracts'
import { describe, expect, it } from 'vitest'

const baseDraft = {
  spanish: 'el edificio con solera',
  russian: 'здание с историей',
  definitionEs: 'Edificio con prestigio o historia.',
  examples: [
    'Compraron un edificio con solera en el centro.',
    'Es un barrio de edificios con solera.',
  ],
  gender: null,
  wrongRussian: ['новостройка', 'сарай', 'мост'],
  wrongSpanish: ['el rascacielos', 'la casucha', 'el puente'],
  imageUrl: null,
  imagePhotographerName: null,
  imagePhotographerUrl: null,
  imagePageUrl: null,
  imageProvider: null,
  imageDownloadLocation: null,
}

describe('createWordSchema', () => {
  it('accepts null partOfSpeech', () => {
    const result = createWordSchema.safeParse({
      ...baseDraft,
      partOfSpeech: null,
    })

    expect(result.success).toBe(true)
  })

  it('rejects gender when partOfSpeech is null', () => {
    const result = createWordSchema.safeParse({
      ...baseDraft,
      partOfSpeech: null,
      gender: 'masculine',
    })

    expect(result.success).toBe(false)
  })

  it('still requires gender for sustantivo', () => {
    const result = createWordSchema.safeParse({
      ...baseDraft,
      partOfSpeech: 'sustantivo',
      gender: null,
    })

    expect(result.success).toBe(false)
  })
})

describe('updateWordCardSchema', () => {
  it('rejects null partOfSpeech', () => {
    const result = updateWordCardSchema.safeParse({
      ...baseDraft,
      partOfSpeech: null,
    })

    expect(result.success).toBe(false)
  })
})
