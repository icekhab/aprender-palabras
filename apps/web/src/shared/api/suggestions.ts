import type { SuggestionsResponse } from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export async function getDbSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<SuggestionsResponse> {
  return fetchSuggestions(`/api/suggestions/db`, query, signal)
}

export async function getAiSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<SuggestionsResponse> {
  return fetchSuggestions(`/api/suggestions/ai`, query, signal)
}

async function fetchSuggestions(
  path: string,
  query: string,
  signal?: AbortSignal,
): Promise<SuggestionsResponse> {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`${path}?${params}`, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw await ApiError.fromResponse(response)
  }

  return response.json() as Promise<SuggestionsResponse>
}
