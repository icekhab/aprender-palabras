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
  it('renders the protected screen for an authenticated user', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (url === '/api/tests') {
        return jsonResponse([
          { name: 'Alpha', size: 10 },
          { name: 'Beta', size: 20 },
        ])
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    expect(await screen.findByText(user.login)).toBeInTheDocument()
    expect(
      await screen.findByRole('cell', { name: 'Alpha' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '10' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Beta' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '20' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/tests', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    })
  })

  it('shows a retry action when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        if (String(input) === '/api/auth/me') {
          return jsonResponse(user)
        }

        return errorResponse(500)
      }),
    )

    renderApp()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los datos.',
    )
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
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

      if (url === '/api/tests') {
        return jsonResponse([])
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
      expect(
        screen.getByRole('heading', { name: 'Prueba' }),
      ).toBeInTheDocument()
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
