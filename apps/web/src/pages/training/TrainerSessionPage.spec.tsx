import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEEDBACK_HOLD_MS } from './feedback'
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
    wrongRussian: string[]
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
    wrongRussian: overrides.wrongRussian ?? ['бежать', 'стоять', 'сидеть'],
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

function mockSession(words: ReturnType<typeof sessionWord>[]) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url === `/api/training/trainers/${TRAINER_ID}`) {
      return new Response(
        JSON.stringify({
          id: TRAINER_ID,
          kind: 'daily',
          slot: 1,
          sourceLabel: 'Palabras nuevas',
          words,
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
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('TrainerSessionPage', () => {
  it('shows progress during intro and starts type 1 after intros', async () => {
    const speak = stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        userCardId: 'card-1',
        spanish: 'esperar',
        russian: 'ждать',
      }),
    ])

    renderSession()

    expect(await screen.findByText('esperar')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Progreso del entrenamiento' }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(speak).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Vale' }))

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ждать' })).toBeInTheDocument()
  })

  it('opens exercise 1 when there is no intro', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        completedTrainerCount: 3,
        showIntro: false,
        spanish: 'vieja',
        russian: 'старая',
        wrongRussian: ['новая', 'молодая', 'добрая'],
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    expect(screen.getByText('vieja')).toBeInTheDocument()
  })

  it('highlights a correct choice then shows the word card; Siguiente advances', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 1,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'привет' }))
    expect(screen.queryByText('Correcto')).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })

    expect(screen.queryByText('Recuerda la palabra')).not.toBeInTheDocument()
    expect(screen.getByText('hola')).toBeInTheDocument()
    expect(
      screen.queryByText('Tu respuesta es incorrecta'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Ejercicio 2')).toBeInTheDocument()
  })

  it('highlights wrong and correct options then shows incorrect banner on the card', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 1,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'пока' }))
    expect(screen.getByRole('button', { name: 'привет' })).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })

    expect(screen.getByText('Tu respuesta es incorrecta')).toBeInTheDocument()
    expect(screen.getByText('hola')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
  })

  it('confirms exit and warns about losing progress', async () => {
    stubSpeech()
    mockSession([sessionWord()])

    renderSession()

    expect(await screen.findByText('esperar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(
      screen.getByRole('dialog', { name: '¿Salir del entrenamiento?' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByText('Home')).toBeInTheDocument()
  })
})
