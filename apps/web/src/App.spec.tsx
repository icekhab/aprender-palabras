import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the message returned by the API', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Hello world' }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    expect(
      await screen.findByRole('heading', { name: 'Hello world' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/hello', {
      headers: {
        Accept: 'application/json',
      },
    })
  })

  it('shows a retry action when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response),
    )

    renderApp()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось получить ответ API.',
    )
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeEnabled()
  })
})
