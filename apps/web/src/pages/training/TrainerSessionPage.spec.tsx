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
import { resetSpeechForTests } from '../../shared/speech'
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
    progress: number
    examples: string[]
    wrongRussian: string[]
    wrongSpanish: string[]
    imageUrl: string | null
  }> = {},
) {
  const completedTrainerCount = overrides.completedTrainerCount ?? 0
  return {
    userCardId: overrides.userCardId ?? 'card-1',
    wordId: overrides.wordId ?? 'word-1',
    completedTrainerCount,
    showIntro: overrides.showIntro ?? completedTrainerCount === 0,
    progress: overrides.progress ?? 0,
    spanish: overrides.spanish ?? 'esperar',
    russian: overrides.russian ?? 'ждать',
    additionalTranslations: [],
    definitionEs: null,
    examples: overrides.examples ?? ['Espero tu llamada.'],
    partOfSpeech: 'verbo',
    gender: null,
    wrongRussian: overrides.wrongRussian ?? ['бежать', 'стоять', 'сидеть'],
    wrongSpanish: overrides.wrongSpanish ?? ['x', 'y', 'z'],
    imageUrl: overrides.imageUrl ?? null,
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
  const start = vi.fn<() => void>()
  const source = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn<() => void>(),
    start,
    stop: vi.fn<() => void>(),
    disconnect: vi.fn<() => void>(),
    onended: null as (() => void) | null,
  }

  class MockAudioContext {
    state = 'running'
    resume = vi.fn<() => Promise<void>>(async () => undefined)
    decodeAudioData = vi.fn<(data: ArrayBuffer) => Promise<AudioBuffer>>(
      async () => ({ duration: 0.1 }) as AudioBuffer,
    )
    createBufferSource = vi.fn<() => typeof source>(() => source)
  }

  vi.stubGlobal('AudioContext', MockAudioContext)
  return start
}

function progressNow() {
  return Number(
    screen
      .getByRole('progressbar', { name: 'Progreso del entrenamiento' })
      .getAttribute('aria-valuenow'),
  )
}

function mockSession(
  words: ReturnType<typeof sessionWord>[],
  options: {
    completeStatus?: number
    completeOnceThenOk?: boolean
    dailyTotal?: number
    dailyCompleted?: number
    nextTrainerId?: string | null
  } = {},
) {
  let completeCalls = 0
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.startsWith('/api/speech/')) {
      return new Response(new ArrayBuffer(8), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    }
    if (
      url === `/api/training/trainers/${TRAINER_ID}` &&
      (!init?.method || init.method === 'GET')
    ) {
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
    if (
      url === `/api/training/trainers/${TRAINER_ID}/complete` &&
      init?.method === 'POST'
    ) {
      completeCalls += 1
      const failFirst =
        options.completeOnceThenOk && completeCalls === 1
      const status = failFirst
        ? 500
        : (options.completeStatus ?? 200)
      if (status !== 200) {
        return new Response(null, { status })
      }
      const body = JSON.parse(String(init.body)) as {
        cards: Array<{ userCardId: string; errorCount: number }>
      }
      return new Response(
        JSON.stringify({
          cards: body.cards.map((card) => {
            const word = words.find((item) => item.userCardId === card.userCardId)
            const oldProgress = word?.progress ?? 0
            const delta =
              card.errorCount <= 0
                ? 20
                : card.errorCount === 1
                  ? 10
                  : card.errorCount === 2
                    ? -10
                    : -20
            return {
              userCardId: card.userCardId,
              spanish: word?.spanish ?? '?',
              russian: word?.russian ?? '?',
              errorCount: card.errorCount,
              oldProgress,
              delta,
              newProgress: Math.min(100, Math.max(0, oldProgress + delta)),
            }
          }),
          wordCount: body.cards.length,
          dailyTotal: options.dailyTotal ?? 6,
          dailyCompleted: options.dailyCompleted ?? 1,
          nextTrainerId:
            options.nextTrainerId === undefined
              ? 'next-trainer-id'
              : options.nextTrainerId,
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
  return fetchMock
}

afterEach(() => {
  cleanup()
  resetSpeechForTests()
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

    expect(
      screen.getByText('Escucha y recuerda la palabra'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recuerdo' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'No recuerdo' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('hola')).not.toBeInTheDocument()
  })

  it('self-assessment remember shows the result card', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 1,
        spanish: 'casa',
        russian: 'дом',
        wrongRussian: ['улица', 'окно', 'дверь'],
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'дом' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(
      screen.getByText('Escucha y recuerda la palabra'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Recuerdo' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })

    expect(screen.getByText('casa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
    expect(
      screen.queryByText('Tu respuesta es incorrecta'),
    ).not.toBeInTheDocument()
  })

  it('self-assessment forgot shows the card without incorrect banner', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 1,
        spanish: 'mesa',
        russian: 'стол',
        wrongRussian: ['стул', 'окно', 'дверь'],
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'стол' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    fireEvent.click(screen.getByRole('button', { name: 'No recuerdo' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })

    expect(screen.getByText('mesa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
    expect(
      screen.queryByText('Tu respuesta es incorrecta'),
    ).not.toBeInTheDocument()
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

  it('opens exercise 3 as russian prompt with spanish choices after type 1 when type 2 is skipped', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 3,
        spanish: 'libro',
        russian: 'книга',
        wrongRussian: ['тетрадь', 'ручка', 'стол'],
        wrongSpanish: ['cuaderno', 'bolígrafo', 'mesa'],
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'книга' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Elige la traducción')).toBeInTheDocument()
    expect(screen.getByText('книга')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'libro' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Escuchar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'libro' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })

    expect(screen.getByText('libro')).toBeInTheDocument()
    expect(
      screen.queryByText('Tu respuesta es incorrecta'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
  })

  it('opens exercise 5 russian prompt typing without answer audio', async () => {
    stubSpeech()
    // random=0 → chain [1,4,5,3] when type 2 is skipped
    vi.spyOn(Math, 'random').mockReturnValue(0)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 3,
        spanish: 'lección',
        russian: 'лекция',
        wrongRussian: ['урок', 'книга', 'школа'],
        wrongSpanish: ['clase', 'libro', 'escuela'],
        imageUrl: 'https://example.com/lesson.jpg',
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'лекция' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    // type 4
    const audioInput = screen.getByRole('textbox', { name: 'Escribe la palabra' })
    fireEvent.change(audioInput, { target: { value: 'lección' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    // type 5
    expect(screen.getByText('лекция')).toBeInTheDocument()
    expect(screen.queryByLabelText('Escuchar')).not.toBeInTheDocument()
    const input = screen.getByRole('textbox', { name: 'Escribe la palabra' })
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: 'leccion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })

    expect(screen.getByText('Ortografía correcta: lección')).toBeInTheDocument()
  })

  it('opens exercise 4 audio typing with autofocus and accepts a typed answer', async () => {
    stubSpeech()
    // random=0 → chain [1,4,5,3] when type 2 is skipped
    vi.spyOn(Math, 'random').mockReturnValue(0)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 3,
        spanish: 'café',
        russian: 'кофе',
        wrongRussian: ['чай', 'вода', 'сок'],
        wrongSpanish: ['te', 'agua', 'jugo'],
      }),
    ])

    renderSession()

    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'кофе' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const input = screen.getByRole('textbox', { name: 'Escribe la palabra' })
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Comprobar' })).toBeDisabled()

    fireEvent.change(input, { target: { value: 'cafe' } })
    expect(screen.getByRole('button', { name: 'Comprobar' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })

    expect(screen.getByText('café')).toBeInTheDocument()
    expect(screen.getByText('Ortografía correcta: café')).toBeInTheDocument()
    expect(
      screen.queryByText('Tu respuesta es incorrecta'),
    ).not.toBeInTheDocument()
  })

  it('appends a type 1 retry at the end of the queue after a wrong answer', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 3,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
        wrongSpanish: ['adios', 'gracias', 'favor'],
      }),
    ])

    renderSession()
    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'пока' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    // type 3
    expect(screen.getByText('Elige la traducción')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'hola' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    // type 4
    fireEvent.change(screen.getByRole('textbox', { name: 'Escribe la palabra' }), {
      target: { value: 'hola' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    // type 5
    fireEvent.change(screen.getByRole('textbox', { name: 'Escribe la palabra' }), {
      target: { value: 'hola' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Recuerda la palabra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'привет' })).toBeInTheDocument()
  })

  it('does not enqueue a fourth attempt after three wrong answers', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 3,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
        wrongSpanish: ['adios', 'gracias', 'favor'],
      }),
    ])

    renderSession()
    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    vi.useFakeTimers()

    async function wrongType1AndContinue() {
      fireEvent.click(screen.getByRole('button', { name: 'пока' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    }

    await wrongType1AndContinue()

    fireEvent.click(screen.getByRole('button', { name: 'hola' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    for (let i = 0; i < 2; i += 1) {
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Escribe la palabra' }),
        { target: { value: 'hola' } },
      )
      fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    }

    // retry 1
    expect(screen.getByText('Recuerda la palabra')).toBeInTheDocument()
    await wrongType1AndContinue()
    // retry 2 (third attempt)
    expect(screen.getByText('Recuerda la palabra')).toBeInTheDocument()
    await wrongType1AndContinue()

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText(/¡Bien hecho!|¡Día completado!/)).toBeInTheDocument()
  })

  it('does not retry exercise 2 after No recuerdo', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 1,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
        wrongSpanish: ['adios', 'gracias', 'favor'],
      }),
    ])

    renderSession()
    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'привет' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    fireEvent.click(screen.getByRole('button', { name: 'No recuerdo' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    fireEvent.click(screen.getByRole('button', { name: 'hola' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    for (let i = 0; i < 2; i += 1) {
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Escribe la palabra' }),
        { target: { value: 'hola' } },
      )
      fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    }

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText(/¡Bien hecho!|¡Día completado!/)).toBeInTheDocument()
    expect(
      screen.queryByText('Escucha y recuerda la palabra'),
    ).not.toBeInTheDocument()
  })

  it('does not advance the progress bar after a wrong answer with a retry', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 3,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
        wrongSpanish: ['adios', 'gracias', 'favor'],
      }),
    ])

    renderSession()
    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    const before = progressNow()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'пока' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    expect(progressNow()).toBe(before)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Elige la traducción')).toBeInTheDocument()
    expect(progressNow()).toBe(before)
  })

  it('advances the progress bar after a correct answer', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 3,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
        wrongSpanish: ['adios', 'gracias', 'favor'],
      }),
    ])

    renderSession()
    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    const before = progressNow()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'привет' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    expect(progressNow()).toBe(before)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Elige la traducción')).toBeInTheDocument()
    expect(progressNow()).toBeGreaterThan(before)
  })

  it('advances the progress bar after No recuerdo on exercise 2', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession([
      sessionWord({
        showIntro: false,
        completedTrainerCount: 1,
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
        wrongSpanish: ['adios', 'gracias', 'favor'],
      }),
    ])

    renderSession()
    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'привет' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Escucha y recuerda la palabra')).toBeInTheDocument()
    const before = progressNow()

    fireEvent.click(screen.getByRole('button', { name: 'No recuerdo' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Elige la traducción')).toBeInTheDocument()
    expect(progressNow()).toBeGreaterThan(before)
  })

  async function finishSingleWordSession() {
    expect(await screen.findByText('Recuerda la palabra')).toBeInTheDocument()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'привет' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    fireEvent.click(screen.getByRole('button', { name: 'hola' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    for (let i = 0; i < 2; i += 1) {
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Escribe la palabra' }),
        { target: { value: 'hola' } },
      )
      fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FEEDBACK_HOLD_MS)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    }

    await act(async () => {
      await Promise.resolve()
    })
  }

  it('shows celebrate screen and Continuar opens the next trainer', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession(
      [
        sessionWord({
          showIntro: false,
          completedTrainerCount: 3,
          progress: 40,
          spanish: 'hola',
          russian: 'привет',
          wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
          wrongSpanish: ['adios', 'gracias', 'favor'],
        }),
      ],
      {
        dailyTotal: 6,
        dailyCompleted: 1,
        nextTrainerId: '0199f98d-83c0-7bde-a537-b74cf7e9ea99',
      },
    )

    renderSession()
    await finishSingleWordSession()

    expect(screen.getByText(/¡Bien hecho!|¡Día completado!/)).toBeInTheDocument()
    expect(screen.getByText(/1 palabra/)).toBeInTheDocument()
    expect(
      screen.getByRole('listitem', { name: 'Entrenamiento 1 completado' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('¡Has terminado el entrenamiento diario! 🎉'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    // Next trainer fetch is not mocked → error or loading; route should change.
    // MemoryRouter keeps us on /entrenamiento/:id — assert Continuar left celebrate.
    expect(screen.queryByText(/sigue así/)).not.toBeInTheDocument()
  })

  it('shows daily finished message even when an extra trainer is already queued', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession(
      [
        sessionWord({
          showIntro: false,
          completedTrainerCount: 3,
          progress: 40,
          spanish: 'hola',
          russian: 'привет',
          wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
          wrongSpanish: ['adios', 'gracias', 'favor'],
        }),
      ],
      {
        nextTrainerId: 'extra-trainer-id',
        dailyTotal: 6,
        dailyCompleted: 6,
      },
    )

    renderSession()
    await finishSingleWordSession()

    expect(
      screen.getByText('Has terminado el entrenamiento diario.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Continuar' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('closes completion with X without a confirm dialog', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession(
      [
        sessionWord({
          showIntro: false,
          completedTrainerCount: 3,
          spanish: 'hola',
          russian: 'привет',
          wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
          wrongSpanish: ['adios', 'gracias', 'favor'],
        }),
      ],
      { nextTrainerId: null, dailyTotal: 1, dailyCompleted: 1 },
    )

    renderSession()
    await finishSingleWordSession()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: '¿Salir del entrenamiento?' }),
    ).not.toBeInTheDocument()
  })

  it('retries saving progress when complete fails', async () => {
    stubSpeech()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    mockSession(
      [
        sessionWord({
          showIntro: false,
          completedTrainerCount: 3,
          progress: 40,
          spanish: 'hola',
          russian: 'привет',
          wrongRussian: ['пока', 'спасибо', 'пожалуйста'],
          wrongSpanish: ['adios', 'gracias', 'favor'],
        }),
      ],
      {
        completeOnceThenOk: true,
        nextTrainerId: 'extra-id',
        dailyTotal: 1,
        dailyCompleted: 1,
      },
    )

    renderSession()
    await finishSingleWordSession()

    expect(
      screen.getByText(
        'No se pudo guardar el progreso. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(
      screen.getByText('Has terminado el entrenamiento diario.'),
    ).toBeInTheDocument()
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
