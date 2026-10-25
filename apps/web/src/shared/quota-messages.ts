import { isGenerationQuotaError } from './api/auth'

export type GenerationQuotaCopy = {
  title: string
  description: string
}

export function generationQuotaScreenCopy(limit: number): GenerationQuotaCopy {
  return {
    title: 'Has alcanzado tu límite diario',
    description: `Puedes generar hasta ${limit} palabras al día. Vuelve mañana para añadir más.`,
  }
}

export function generationQuotaToastCopy(limit: number): GenerationQuotaCopy {
  return {
    title: 'Cuota diaria agotada',
    description: `Puedes generar hasta ${limit} palabras al día.`,
  }
}

export function generationQuotaScreenCopyFromError(
  error: unknown,
): GenerationQuotaCopy | null {
  if (!isGenerationQuotaError(error) || error.limit === null) {
    return null
  }

  return generationQuotaScreenCopy(error.limit)
}

export function generationQuotaToastCopyFromError(
  error: unknown,
): GenerationQuotaCopy | null {
  if (!isGenerationQuotaError(error) || error.limit === null) {
    return null
  }

  return generationQuotaToastCopy(error.limit)
}
