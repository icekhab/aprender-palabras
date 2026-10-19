import type { DailyTrainingTodayResponse } from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export async function getTodayTraining(
  signal?: AbortSignal,
): Promise<DailyTrainingTodayResponse> {
  const response = await fetch('/api/training/today', {
    method: 'GET',
    credentials: 'same-origin',
    signal,
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new ApiError(`API returned ${response.status}`, response.status)
  }

  return response.json() as Promise<DailyTrainingTodayResponse>
}
