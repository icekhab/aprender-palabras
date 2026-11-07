import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
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
  stop: ReturnType<typeof vi.fn<() => void>>
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
    stop = vi.fn<() => void>(() => {
      this.onend?.()
    })
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

function stubMic(getUserMedia?: ReturnType<typeof vi.fn>) {
  const stop = vi.fn<() => void>()
  const media =
    getUserMedia ??
    vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () =>
      ({
        getTracks: () => [{ stop }],
      }) as unknown as MediaStream,
    )
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia: media },
    audioSession: { type: 'auto' },
  })
  return { getUserMedia: media, stop }
}

afterEach(() => {
  cleanup()
  resetMicrophonePermissionForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SpeakExerciseScreen mic access', () => {
  it('starts SpeechRecognition synchronously and holds getUserMedia without release', async () => {
    const recognition = stubRecognition()
    const { getUserMedia } = stubMic()
    const releaseSpy = vi.spyOn(audioSession, 'releaseMicToPlayback')
    const prepareSpy = vi.spyOn(audioSession, 'prepareAudioSessionForMicrophone')

    render(
      <SpeakExerciseScreen
        word={word()}
        onRevealResult={vi.fn()}
        onSkipSpeak={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))

    expect(screen.getByText('Escuchando…')).toBeInTheDocument()
    expect(recognition.latest()?.start).toHaveBeenCalledOnce()
    expect(prepareSpy).toHaveBeenCalledOnce()
    expect(releaseSpy).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledOnce()
    })
  })

  it('shows Permitir micrófono after STT denial and primes via the link', async () => {
    let allowed = false
    const stop = vi.fn<() => void>()
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () => {
      if (!allowed) {
        throw new DOMException('Permission denied', 'NotAllowedError')
      }
      return {
        getTracks: () => [{ stop }],
      } as unknown as MediaStream
    })

    stubRecognition({
      onStart: (instance) => {
        queueMicrotask(() => {
          instance.onerror?.({ error: 'not-allowed' })
        })
      },
    })
    stubMic(getUserMedia)

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

    allowed = true
    stubRecognition()
    fireEvent.click(screen.getByRole('button', { name: 'Permitir micrófono' }))

    await waitFor(() => {
      expect(
        screen.queryByText(/Permite el micrófono para continuar/),
      ).not.toBeInTheDocument()
    })
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
    stubMic()

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

  it('second click without interim waits for onend before idle, then can start again', async () => {
    const recognition = stubRecognition()
    const { stop: trackStop } = stubMic()

    render(
      <SpeakExerciseScreen
        word={word()}
        onRevealResult={vi.fn()}
        onSkipSpeak={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))
    expect(screen.getByText('Escuchando…')).toBeInTheDocument()
    const first = recognition.latest()
    expect(first?.start).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Escuchando…' }))
    expect(first?.stop).toHaveBeenCalledOnce()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hablar' })).toBeEnabled()
    })
    expect(screen.getByText('Di la palabra en español')).toBeInTheDocument()
    expect(trackStop).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))
    expect(screen.getByText('Escuchando…')).toBeInTheDocument()
    expect(recognition.latest()?.start).toHaveBeenCalledOnce()
    expect(recognition.latest()).not.toBe(first)
  })

  it('keeps mic disabled until stopAndWait finishes', async () => {
    const recognition = stubRecognition()
    stubMic()

    render(
      <SpeakExerciseScreen
        word={word()}
        onRevealResult={vi.fn()}
        onSkipSpeak={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))
    const first = recognition.latest()
    expect(first).not.toBeNull()

    // Defer onend so stopping stays active.
    first!.stop = vi.fn<() => void>()

    fireEvent.click(screen.getByRole('button', { name: 'Escuchando…' }))
    expect(screen.getByRole('button', { name: 'Escuchando…' })).toBeDisabled()

    await act(async () => {
      first!.onend?.()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hablar' })).toBeEnabled()
    })
  })

  it('second click with wrong interim scores incorrect', async () => {
    const feedbackSpy = vi.spyOn(feedbackSound, 'playFeedbackSound')
    const recognition = stubRecognition()
    stubMic()

    render(
      <SpeakExerciseScreen
        word={word()}
        onRevealResult={vi.fn()}
        onSkipSpeak={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))
    recognition.latest()?.onresult?.({
      results: [{ isFinal: false, 0: { transcript: 'adios' } }],
    })
    expect(screen.getByText('Escuchando…')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Escuchando…' }))

    await waitFor(() => {
      expect(feedbackSpy).toHaveBeenCalledWith('incorrect')
    })
  })
})
