import type { TestsResponse } from '@aprender-palabras/contracts'

export async function getTests(): Promise<TestsResponse> {
  const response = await fetch('/api/tests', {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }

  return response.json() as Promise<TestsResponse>
}
