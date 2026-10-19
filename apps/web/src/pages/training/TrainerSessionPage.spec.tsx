import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrainerSessionPage } from './TrainerSessionPage'

const TRAINER_ID = '0199f98d-83c0-7bde-a537-b74cf7e9ea34'

function sessionWord(
  overrides: Partial<{
    userCardId: string
    wordId: string
    spanish: string
    russian: string
    completedTrainerCount: number
    showIntro: boolean
    examples: string[]
  }> = {},
) {
  const completedTrainerCount = overrides.completedTrainerCount ?? 0
  return {
    userCardId: overrides.userCardId ?? 'card-1',
    wordId: overrides.wordId ?? 'word-1',
    completedTrainerCount,
    showIntro: overrides.showIntro ?? completedTrainerCount === 0,
    progress: 0,
    spanish: overrides.spanish ?? 'esperar',
    russian: overrides.russian ?? 'ждать',
    additionalTranslations: [],
    definitionEs: null,
    examples: overrides.examples ?? ['Espero tu llamada.'],
    partOfSpeech: 'verbo',
    gender: null,
    wrongRussian: ['a', 'b', 'c'],
    wrongSpanish: ['x', 'y', 'z'],
    imageUrl: null,
    imagePhotographerName: null,
    imagePhotographerUrl: null,
    imagePageUrl: null,
    imageProvider: null,
  }
}

function renderSession(initialPath = `/entrenamiento/${TRAINER_ID}`) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<p>Home</p>} />
          <Route
            path="/entrenamiento/:trainerId"
            element={<TrainerSessionPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function stubSpeech() {
  const speak = vi.fn<(utterance: SpeechSynthesisUtterance) => void>()
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [],
    cancel: vi.fn<() => void>(),
    speak,
    addEventListener: vi.fn<() => void>(),
    removeEventListener: vi.fn<() => void>(),
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
  return speak
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TrainerSessionPage', () => {
  it('shows intro cards, speaks spanish, advances with Vale, then goes home', async () => {
    const speak = stubSpeech()
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url === `/api/training/trainers/${TRAINER_ID}`) {
        return new Response(
          JSON.stringify({
            id: TRAINER_ID,
            kind: 'daily',
            slot: 1,
            sourceLabel: 'Palabras nuevas',
            words: [
              sessionWord({
                userCardId: 'card-1',
                spanish: 'esperar',
                russian: 'ждать',
              }),
              sessionWord({
                userCardId: 'card-2',
                wordId: 'word-2',
                spanish: 'casa',
                russian: 'дом',
                examples: [],
              }),
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSession()

    expect(await screen.findByText('esperar')).toBeInTheDocument()
    expect(screen.getByText('ждать')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    await waitFor(() => {
      expect(speak).toHaveBeenCalled()
    })
    const utterance = speak.mock.calls[0]?.[0] as { text: string; lang: string }
    expect(utterance.text).toBe('esperar')
    expect(utterance.lang).toBe('es-ES')

    fireEvent.click(screen.getByRole('button', { name: 'Vale' }))

    expect(await screen.findByText('casa')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Vale' }))

    expect(await screen.findByText('Home')).toBeInTheDocument()
  })

  it('skips words without intro and redirects home when none remain', async () => {
    stubSpeech()
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url === `/api/training/trainers/${TRAINER_ID}`) {
        return new Response(
          JSON.stringify({
            id: TRAINER_ID,
            kind: 'daily',
            slot: 1,
            sourceLabel: 'Repaso',
            words: [
              sessionWord({
                completedTrainerCount: 3,
                showIntro: false,
                spanish: 'vieja',
              }),
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSession()

    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(screen.queryByText('vieja')).not.toBeInTheDocument()
  })

  it('confirms exit and warns about losing progress', async () => {
    stubSpeech()
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url === `/api/training/trainers/${TRAINER_ID}`) {
        return new Response(
          JSON.stringify({
            id: TRAINER_ID,
            kind: 'daily',
            slot: 1,
            sourceLabel: 'Palabras nuevas',
            words: [sessionWord()],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSession()

    expect(await screen.findByText('esperar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(
      screen.getByRole('dialog', { name: '¿Salir del entrenamiento?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Perderás el progreso de este entrenamiento.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByText('Home')).toBeInTheDocument()
  })
})
