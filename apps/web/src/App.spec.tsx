import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const user = {
  id: '0199f98d-83c0-7bde-a537-b74cf7e9ea34',
  login: 'icekhab@gmail.com',
}

function renderApp(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the home header for an authenticated user', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    expect(
      await screen.findByText('Aprender Palabras', { selector: 'header p' }),
    ).toBeInTheDocument()
    expect(screen.getByText(user.login)).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar palabra')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    })
  })

  it('loads suggestions after debounce', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (url.startsWith('/api/suggestions?')) {
        return jsonResponse({
          suggestions: [{ spanish: 'esperar', russian: 'ждать' }],
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    const searchInput = await screen.findByLabelText('Buscar palabra')
    fireEvent.change(searchInput, { target: { value: 'esperar' } })

    expect(await screen.findByText('esperar')).toBeInTheDocument()
    expect(screen.getByText('ждать')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/suggestions?q=esperar',
      expect.objectContaining({
        credentials: 'same-origin',
      }),
    )
  })

  it('redirects an unauthenticated user to the login page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(errorResponse(401)),
    )

    renderApp()

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument()
  })

  it('logs in and keeps the entered login when credentials are rejected', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return errorResponse(401)
      }

      if (url === '/api/auth/login') {
        const body = JSON.parse(String(init?.body)) as {
          login: string
          password: string
        }

        if (body.password === 'wrong') {
          return errorResponse(401)
        }

        return jsonResponse(user)
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/login')

    const loginInput = await screen.findByLabelText('Usuario')
    const passwordInput = screen.getByLabelText('Contraseña')
    fireEvent.change(loginInput, { target: { value: user.login } })
    fireEvent.change(passwordInput, { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(
      await screen.findByText('Usuario o contraseña incorrectos.'),
    ).toBeInTheDocument()
    expect(loginInput).toHaveValue(user.login)

    fireEvent.change(passwordInput, { target: { value: '123345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Buscar palabra')).toBeInTheDocument()
    })
  })
})

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
  } as Response
}
