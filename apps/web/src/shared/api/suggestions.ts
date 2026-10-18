import type { SuggestionsResponse } from '@aprender-palabras/contracts'
import { ApiError } from './auth'

export async function getSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<SuggestionsResponse> {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`/api/suggestions?${params}`, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new ApiError(`API returned ${response.status}`, response.status)
  }

  return response.json() as Promise<SuggestionsResponse>
}
