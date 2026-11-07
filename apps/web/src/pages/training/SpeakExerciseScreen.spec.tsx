import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import * as audioSession from '../../shared/audio-session'
import * as feedbackSound from '../../shared/feedback-sound'
import * as resetPlayback from '../../shared/reset-playback-audio'
import { resetMicrophonePermissionForTests } from '../../shared/speech-recognition'
import { SpeakExerciseScreen } from './SpeakExerciseScreen'

function word(): TrainerSessionWord {
  return {
    userCardId: 'card-1',
    wordId: 'word-1',
    completedTrainerCount: 3,
    showIntro: false,
    progress: 0,
    spanish: 'hola',
    russian: 'привет',
    additionalTranslations: [],
    definitionEs: null,
    examples: [],
    partOfSpeech: null,
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

type MockRecognitionInstance = {
  onresult: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  start: ReturnType<typeof vi.fn<() => void>>
  abort: ReturnType<typeof vi.fn<() => void>>
}

function stubRecognition(options?: {
  onStart?: (instance: MockRecognitionInstance) => void
}) {
  let latest: MockRecognitionInstance | null = null

  class MockRecognition {
    lang = ''
    continuous = false
    interimResults = false
    maxAlternatives = 1
    onresult: MockRecognitionInstance['onresult'] = null
    onerror: MockRecognitionInstance['onerror'] = null
    onend: MockRecognitionInstance['onend'] = null
    start = vi.fn<() => void>(() => {
      options?.onStart?.(this)
    })
    stop = vi.fn<() => void>()
    abort = vi.fn<() => void>(() => {
      this.onend?.()
    })

    constructor() {
      latest = this
    }
  }

  vi.stubGlobal('webkitSpeechRecognition', MockRecognition)
  return {
    latest: () => latest,
  }
}

afterEach(() => {
  cleanup()
  resetMicrophonePermissionForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SpeakExerciseScreen mic access', () => {
  it('does not call getUserMedia on Hablar', async () => {
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >()
    stubRecognition()
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
      audioSession: { type: 'playback' },
    })

    render(
      <SpeakExerciseScreen
        word={word()}
        onRevealResult={vi.fn()}
        onSkipSpeak={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))

    await waitFor(() => {
      expect(screen.getByText('Escuchando…')).toBeInTheDocument()
    })
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('shows Permitir micrófono after STT denial and primes only via the link', async () => {
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () =>
      ({
        getTracks: () => [{ stop: vi.fn<() => void>() }],
      }) as unknown as MediaStream,
    )

    stubRecognition({
      onStart: (instance) => {
        queueMicrotask(() => {
          instance.onerror?.({ error: 'not-allowed' })
        })
      },
    })
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
      audioSession: { type: 'playback' },
    })

    render(
      <SpeakExerciseScreen
        word={word()}
        onRevealResult={vi.fn()}
        onSkipSpeak={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))

    expect(
      await screen.findByText(/Permite el micrófono para continuar/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Permitir micrófono' }),
    ).toBeInTheDocument()
    expect(getUserMedia).not.toHaveBeenCalled()

    // Next Hablar after Permitir should succeed without STT denial.
    stubRecognition()
    fireEvent.click(screen.getByRole('button', { name: 'Permitir micrófono' }))

    await waitFor(() => {
      expect(
        screen.queryByText(/Permite el micrófono para continuar/),
      ).not.toBeInTheDocument()
    })
    expect(getUserMedia).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.getByText('Escuchando…')).toBeInTheDocument()
    })
  })

  it('releases mic and resets audio graph before feedback on correct answer', async () => {
    const releaseSpy = vi.spyOn(audioSession, 'releaseMicToPlayback')
    const resetSpy = vi.spyOn(resetPlayback, 'resetPlaybackAudioGraph')
    const feedbackSpy = vi.spyOn(feedbackSound, 'playFeedbackSound')
    const order: string[] = []
    releaseSpy.mockImplementation(() => {
      order.push('release')
    })
    resetSpy.mockImplementation(() => {
      order.push('reset')
    })
    feedbackSpy.mockImplementation(() => {
      order.push('feedback')
    })

    const recognition = stubRecognition()
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn(),
      },
      audioSession: { type: 'auto' },
    })

    render(
      <SpeakExerciseScreen
        word={word()}
        onRevealResult={vi.fn()}
        onSkipSpeak={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))
    await waitFor(() => {
      expect(screen.getByText('Escuchando…')).toBeInTheDocument()
    })
    order.length = 0

    recognition.latest()?.onresult?.({
      results: [{ isFinal: true, 0: { transcript: 'hola' } }],
    })

    await waitFor(() => {
      expect(feedbackSpy).toHaveBeenCalledWith('correct')
    })
    expect(order).toEqual(['release', 'reset', 'feedback'])
  })
})
