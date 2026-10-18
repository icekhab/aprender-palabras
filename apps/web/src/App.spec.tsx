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

function emptyDictionaryResponse() {
  return jsonResponse({
    totalCount: 0,
    averageProgress: 0,
    hasMore: false,
    items: [],
  })
}

function isDictionaryListRequest(url: string) {
  return url.startsWith('/api/words?')
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the home header for an authenticated user', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
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
    expect(await screen.findByRole('heading', { name: 'Diccionario' })).toBeInTheDocument()
    expect(screen.getByText('0 palabras añadidas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cuenta' })).toHaveTextContent('I')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    })
  })

  it('opens account menu and navigates to settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input)
        if (url === '/api/auth/me') {
          return jsonResponse(user)
        }

        if (isDictionaryListRequest(url)) {
          return emptyDictionaryResponse()
        }

        throw new Error(`Unexpected request: ${url}`)
      }),
    )
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [],
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    })

    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'Cuenta' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajustes' }))

    expect(
      await screen.findByRole('heading', { name: 'Ajustes' }),
    ).toBeInTheDocument()
  })

  it('logs out from the account menu', async () => {
    let authenticated = true
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return authenticated ? jsonResponse(user) : errorResponse(401)
      }

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
      }

      if (url === '/api/auth/logout' && init?.method === 'POST') {
        authenticated = false
        return { ok: true, status: 204 } as Response
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'Cuenta' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument()
  })

  it('saves the selected Spanish voice in settings', async () => {
    const voices = [
      {
        lang: 'es-ES',
        name: 'Spanish Spain',
        default: false,
        localService: true,
        voiceURI: 'es-es-voice',
      },
      {
        lang: 'es-MX',
        name: 'Spanish Mexico',
        default: false,
        localService: true,
        voiceURI: 'es-mx-voice',
      },
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        if (String(input) === '/api/auth/me') {
          return jsonResponse(user)
        }

        throw new Error(`Unexpected request: ${String(input)}`)
      }),
    )
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => voices,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
      cancel: vi.fn<() => void>(),
      speak: vi.fn<(utterance: SpeechSynthesisUtterance) => void>(),
    })
    class MockUtterance {
      text: string
      lang = ''
      voice: SpeechSynthesisVoice | null = null

      constructor(text: string) {
        this.text = text
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance)

    renderApp('/settings')

    const select = await screen.findByLabelText('Voz')
    fireEvent.change(select, { target: { value: 'es-mx-voice' } })

    expect(window.localStorage.getItem('aprender-palabras.spanishVoiceURI')).toBe(
      'es-mx-voice',
    )
  })

  it('loads suggestions after debounce', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
      }

      if (url.startsWith('/api/suggestions?')) {
        return jsonResponse({
          suggestions: [
            {
              spanish: 'esperar',
              russian: 'ждать',
              wordId: null,
              progress: null,
            },
          ],
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    const searchInput = await screen.findByLabelText('Buscar palabra')
    fireEvent.focus(searchInput)
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

  it('hides suggestions on blur and shows them again on focus', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
      }

      if (url.startsWith('/api/suggestions?')) {
        return jsonResponse({
          suggestions: [
            {
              spanish: 'esperar',
              russian: 'ждать',
              wordId: null,
              progress: null,
            },
          ],
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    const searchInput = await screen.findByLabelText('Buscar palabra')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'esperar' } })

    expect(await screen.findByLabelText('Sugerencias')).toBeInTheDocument()

    fireEvent.blur(searchInput)

    expect(screen.queryByLabelText('Sugerencias')).not.toBeInTheDocument()

    fireEvent.focus(searchInput)

    expect(await screen.findByLabelText('Sugerencias')).toBeInTheDocument()
    expect(screen.getByText('esperar')).toBeInTheDocument()
  })

  it('opens the add-word page from a suggestion and confirms create', async () => {
    const draft = {
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: ['ожидать'],
      definitionEs: 'Tener esperanza de algo.',
      examples: ['Espero tu llamada.'],
      partOfSpeech: 'verbo',
      gender: null,
      wrongRussian: ['бежать', 'читать', 'писать'],
      wrongSpanish: ['comer', 'vivir', 'hablar'],
      imageUrl: null,
      imagePhotographerName: null,
      imagePhotographerUrl: null,
      imagePageUrl: null,
      imageProvider: null,
      imageDownloadLocation: null,
    }

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
      }

      if (url.startsWith('/api/suggestions?')) {
        return jsonResponse({
          suggestions: [
            {
              spanish: 'esperar',
              russian: 'ждать',
              wordId: null,
              progress: null,
            },
          ],
        })
      }

      if (url === '/api/words/preview' && init?.method === 'POST') {
        return jsonResponse(draft)
      }

      if (url === '/api/words' && init?.method === 'POST') {
        return jsonResponse({
          id: 'word-1',
          ...draft,
          createdAt: '2026-10-18T12:00:00.000Z',
          updatedAt: '2026-10-18T12:00:00.000Z',
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    const searchInput = await screen.findByLabelText('Buscar palabra')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'esperar' } })

    fireEvent.click(await screen.findByRole('button', { name: /esperar/i }))

    expect(
      await screen.findByRole('heading', { name: 'Añadir palabra' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Tener esperanza de algo.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Buscar palabra')).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/words',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    )
  })

  it('adds an existing dictionary word from a suggestion row', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
      }

      if (url.startsWith('/api/suggestions?')) {
        return jsonResponse({
          suggestions: [
            {
              spanish: 'esperar',
              russian: 'ждать',
              wordId: '0199f98d-83c0-7bde-a537-b74cf7e9ea34',
              progress: null,
            },
          ],
        })
      }

      if (url === '/api/words/existing' && init?.method === 'POST') {
        return jsonResponse({
          id: 'card-1',
          wordId: '0199f98d-83c0-7bde-a537-b74cf7e9ea34',
          spanish: 'esperar',
          russian: 'ждать',
          progress: 0,
          addedAt: '2026-10-18T12:00:00.000Z',
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    const searchInput = await screen.findByLabelText('Buscar palabra')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'esperar' } })

    fireEvent.click(
      await screen.findByRole('button', { name: /Añadir esperar/i }),
    )

    expect(
      await screen.findByLabelText(/esperar — ждать, progreso 0%/i),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/words/existing',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    )
    expect(
      screen.queryByRole('heading', { name: 'Añadir palabra' }),
    ).not.toBeInTheDocument()
  })

  it('shows progress icon for suggestions already in the user dictionary', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url === '/api/auth/me') {
        return jsonResponse(user)
      }

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
      }

      if (url.startsWith('/api/suggestions?')) {
        return jsonResponse({
          suggestions: [
            {
              spanish: 'esperar',
              russian: 'ждать',
              wordId: '0199f98d-83c0-7bde-a537-b74cf7e9ea34',
              progress: 40,
            },
          ],
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    const searchInput = await screen.findByLabelText('Buscar palabra')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'esperar' } })

    expect(
      await screen.findByLabelText(/esperar — ждать, progreso 40%/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Añadir esperar/i }),
    ).not.toBeInTheDocument()
  })

  it('speaks the Spanish word from the add-word page', async () => {
    const draft = {
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: [],
      definitionEs: null,
      examples: ['Espero tu llamada.'],
      partOfSpeech: null,
      gender: null,
      wrongRussian: [],
      wrongSpanish: [],
      imageUrl: null,
      imagePhotographerName: null,
      imagePhotographerUrl: null,
      imagePageUrl: null,
      imageProvider: null,
      imageDownloadLocation: null,
    }

    const speak = vi.fn<(utterance: SpeechSynthesisUtterance) => void>()
    const cancel = vi.fn<() => void>()
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel,
      getVoices: () => [
        {
          lang: 'es-ES',
          name: 'Spanish',
          default: false,
          localService: true,
          voiceURI: 'es',
        },
      ],
    })
    class MockUtterance {
      text: string
      lang = ''
      voice: SpeechSynthesisVoice | null = null

      constructor(text: string) {
        this.text = text
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance)

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input)

        if (url === '/api/auth/me') {
          return jsonResponse(user)
        }

        if (url === '/api/words/preview') {
          return jsonResponse(draft)
        }

        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    renderApp('/words/new?spanish=esperar&russian=%D0%B6%D0%B4%D0%B0%D1%82%D1%8C')

    const listenButtons = await screen.findAllByRole('button', {
      name: 'Escuchar',
    })
    fireEvent.click(listenButtons[0]!)

    expect(cancel).toHaveBeenCalled()
    expect(speak).toHaveBeenCalled()
    const utterance = speak.mock.calls[0]?.[0] as { text: string; lang: string }
    expect(utterance.text).toBe('esperar')
    expect(utterance.lang).toBe('es-ES')
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

      if (isDictionaryListRequest(url)) {
        return emptyDictionaryResponse()
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
