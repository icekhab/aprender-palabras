import type { HelloResponse } from '@aprender-palabras/contracts'

export async function getHello(): Promise<HelloResponse> {
  const response = await fetch('/api/hello', {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }

  return response.json() as Promise<HelloResponse>
}
