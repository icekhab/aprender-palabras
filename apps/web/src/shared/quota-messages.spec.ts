import { describe, expect, it } from 'vitest'
import { ApiError } from './api/auth'
import {
  generationQuotaScreenCopy,
  generationQuotaScreenCopyFromError,
  generationQuotaToastCopy,
  generationQuotaToastCopyFromError,
} from './quota-messages'

describe('quota messages', () => {
  it('formats screen and toast title/description with the limit', () => {
    expect(generationQuotaScreenCopy(2)).toEqual({
      title: 'Has alcanzado tu límite diario',
      description:
        'Puedes generar hasta 2 palabras al día. Vuelve mañana para añadir más.',
    })
    expect(generationQuotaToastCopy(2)).toEqual({
      title: 'Cuota diaria agotada',
      description: 'Puedes generar hasta 2 palabras al día.',
    })
  })

  it('reads limit from a generation quota ApiError', () => {
    const error = new ApiError('Daily quota exceeded', 429, {
      code: 'GENERATION_QUOTA_EXCEEDED',
      limit: 2,
    })
    expect(generationQuotaScreenCopyFromError(error)?.title).toBe(
      'Has alcanzado tu límite diario',
    )
    expect(generationQuotaToastCopyFromError(error)?.description).toContain(
      'hasta 2',
    )
  })
})
