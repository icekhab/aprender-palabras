import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
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

afterEach(() => {
  cleanup()
  resetMicrophonePermissionForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SpeakExerciseScreen mic access link', () => {
  it('shows Permitir micrófono after denial and retries with force', async () => {
    let allowed = false
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () => {
      if (!allowed) {
        throw new DOMException('Permission denied', 'NotAllowedError')
      }
      return {
        getTracks: () => [{ stop: vi.fn<() => void>() }],
      } as unknown as MediaStream
    })

    class MockRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onresult = null
      onerror = null
      onend = null
      start = vi.fn<() => void>()
      stop = vi.fn<() => void>()
      abort = vi.fn<() => void>()
    }

    vi.stubGlobal('webkitSpeechRecognition', MockRecognition)
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

    allowed = true
    fireEvent.click(screen.getByRole('button', { name: 'Permitir micrófono' }))

    await waitFor(() => {
      expect(
        screen.queryByText(/Permite el micrófono para continuar/),
      ).not.toBeInTheDocument()
    })
    expect(getUserMedia.mock.calls.length).toBeGreaterThanOrEqual(2)
    await waitFor(() => {
      expect(screen.getByText('Escuchando…')).toBeInTheDocument()
    })
  })
})
