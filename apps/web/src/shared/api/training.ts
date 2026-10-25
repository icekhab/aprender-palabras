import type {
  CompleteTrainerRequest,
  CompleteTrainerResponse,
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
    throw await ApiError.fromResponse(response)
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
    throw await ApiError.fromResponse(response)
  }

  return response.json() as Promise<TrainerSessionResponse>
}

export async function completeTrainerSession(
  trainerId: string,
  body: CompleteTrainerRequest,
): Promise<CompleteTrainerResponse> {
  const response = await fetch(`/api/training/trainers/${trainerId}/complete`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await ApiError.fromResponse(response)
  }

  return response.json() as Promise<CompleteTrainerResponse>
}
