import type {
  DailyTrainingTodayResponse,
  TrainerSessionResponse,
} from '@aprender-palabras/contracts'
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

export async function getTrainerSession(
  trainerId: string,
  signal?: AbortSignal,
): Promise<TrainerSessionResponse> {
  const response = await fetch(`/api/training/trainers/${trainerId}`, {
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

  return response.json() as Promise<TrainerSessionResponse>
}
