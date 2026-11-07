import { Mic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { Button } from '@/components/ui/button'
import { UnsplashAttribution } from '@/components/unsplash-attribution'
import {
  micReleaseSettleMs,
  releaseMicToPlayback,
} from '../../shared/audio-session'
import { playFeedbackSound } from '../../shared/feedback-sound'
import {
  createSpeechRecognition,
  type SpeechRecognitionSession,
} from '../../shared/speech-recognition'
import { FEEDBACK_HOLD_MS } from './feedback'
import { compareSpanishAnswer } from './spanish-answer'

type ListenState = 'idle' | 'listening' | 'processing'

type SpeakOutcome = {
  correct: boolean
  accentWarning?: string
}

function recognitionErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
      return 'Permite el micrófono para continuar.'
    case 'no-speech':
      return 'No se escuchó nada. Inténtalo de nuevo.'
    case 'audio-capture':
      return 'No se pudo usar el micrófono.'
    case 'network':
      return 'Error de red al reconocer la voz.'
    case 'aborted':
      return ''
    default:
      return 'No se pudo reconocer la voz. Inténtalo de nuevo.'
  }
}

export function SpeakExerciseScreen({
  word,
  onRevealResult,
  onSkipSpeak,
}: {
  word: TrainerSessionWord
  onRevealResult: (result: { correct: boolean; accentWarning?: string }) => void
  onSkipSpeak: () => void
}) {
  const sessionRef = useRef<SpeechRecognitionSession | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const submittedRef = useRef(false)
  const [submitted, setSubmitted] = useState(false)
  const [listenState, setListenState] = useState<ListenState>('idle')
  const [transcript, setTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [outcome, setOutcome] = useState<SpeakOutcome | null>(null)
  const [skipOpen, setSkipOpen] = useState(false)

  function teardownRecognition() {
    sessionRef.current?.abort()
    sessionRef.current = null
    releaseMicToPlayback()
  }

  function clearSettleTimer() {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearSettleTimer()
      teardownRecognition()
    }
  }, [])

  useEffect(() => {
    if (outcome === null) {
      return
    }

    const timer = window.setTimeout(() => {
      onRevealResult(outcome)
    }, FEEDBACK_HOLD_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [outcome, onRevealResult])

  function finishWithResult(result: SpeakOutcome, heard: string) {
    if (submittedRef.current) {
      return
    }

    submittedRef.current = true
    setSubmitted(true)
    setTranscript(heard)
    setErrorMessage('')
    setListenState('processing')
    teardownRecognition()

    const playAndReveal = () => {
      settleTimerRef.current = null
      playFeedbackSound(result.correct ? 'correct' : 'incorrect')
      setOutcome(result)
    }

    const settleMs = micReleaseSettleMs()
    if (settleMs <= 0) {
      playAndReveal()
      return
    }

    settleTimerRef.current = window.setTimeout(playAndReveal, settleMs)
  }

  function acceptTranscript(value: string) {
    if (submittedRef.current) {
      return
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    const result = compareSpanishAnswer(word.spanish, trimmed)
    if (!result.correct) {
      return
    }

    finishWithResult(result, trimmed)
  }

  function rejectForRetry(message: string) {
    if (submittedRef.current) {
      return
    }
    teardownRecognition()
    setTranscript('')
    setListenState('idle')
    setErrorMessage(message)
  }

  function startListening() {
    if (submittedRef.current || listenState === 'listening') {
      return
    }

    clearSettleTimer()
    setErrorMessage('')
    setTranscript('')
    teardownRecognition()

    let lastInterim = ''

    const session = createSpeechRecognition({
      lang: 'es-ES',
      onResult: (value, isFinal) => {
        const trimmed = value.trim()
        setTranscript(trimmed)

        // Interim only: matching draft counts as correct immediately.
        if (!isFinal) {
          lastInterim = trimmed
          if (trimmed) {
            acceptTranscript(trimmed)
          }
          return
        }

        // Final: same comparison rules as typed answers (wrong = error).
        if (!trimmed) {
          rejectForRetry('No se escuchó nada. Inténtalo de nuevo.')
          return
        }

        const result = compareSpanishAnswer(word.spanish, trimmed)
        if (result.correct) {
          acceptTranscript(trimmed)
          return
        }

        finishWithResult(result, trimmed)
      },
      onError: (error) => {
        if (submittedRef.current) {
          return
        }
        const message = recognitionErrorMessage(error)
        if (message) {
          rejectForRetry(message)
          return
        }
        teardownRecognition()
        setListenState('idle')
      },
      onEnd: () => {
        if (submittedRef.current) {
          return
        }
        // Ended with only a non-matching interim — offer retry, do not score.
        if (lastInterim) {
          rejectForRetry('No se reconoció la palabra. Inténtalo de nuevo.')
          return
        }
        setListenState((prev) => (prev === 'listening' ? 'idle' : prev))
      },
    })

    if (!session) {
      setErrorMessage('Este navegador no admite reconocimiento de voz.')
      return
    }

    sessionRef.current = session
    try {
      session.start()
      setListenState('listening')
    } catch {
      teardownRecognition()
      setErrorMessage('No se pudo iniciar el micrófono.')
      setListenState('idle')
    }
  }

  const photographerName = word.imagePhotographerName
  const photographerUrl = word.imagePhotographerUrl
  const disabled = submitted || outcome !== null

  let micTone = 'bg-orange-600 text-white hover:bg-orange-700'
  if (listenState === 'listening') {
    micTone = 'bg-red-600 text-white hover:bg-red-700'
  } else if (outcome?.correct) {
    micTone = 'bg-green-600 text-white'
  } else if (outcome && !outcome.correct) {
    micTone = 'bg-red-600 text-white'
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 sm:px-8">
        <div className="overflow-hidden rounded-2xl">
          {word.imageUrl ? (
            <div className="relative">
              <img
                src={word.imageUrl}
                alt=""
                className="h-44 w-full object-cover sm:h-52"
              />
              {photographerName && photographerUrl ? (
                <UnsplashAttribution
                  photographerName={photographerName}
                  photographerUrl={photographerUrl}
                  variant="overlay"
                />
              ) : null}
            </div>
          ) : (
            <div
              className="flex h-36 items-center justify-center bg-orange-100/80 text-sm text-orange-900/50"
              aria-hidden
            >
              Sin imagen
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <p className="text-center text-2xl font-semibold text-orange-950">
            {word.russian}
          </p>

          <button
            type="button"
            aria-label={
              listenState === 'listening' ? 'Escuchando…' : 'Hablar'
            }
            disabled={disabled}
            className={`inline-flex size-28 cursor-pointer items-center justify-center rounded-full shadow-md transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 disabled:cursor-default sm:size-32 ${micTone}`}
            onClick={startListening}
          >
            <Mic className="size-12 sm:size-14" aria-hidden />
          </button>

          <p className="min-h-6 text-center text-base text-orange-900/70">
            {listenState === 'listening'
              ? 'Escuchando…'
              : transcript || 'Di la palabra en español'}
          </p>

          {errorMessage ? (
            <p role="alert" className="text-center text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="button"
            className="text-sm text-orange-800/70 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
            disabled={disabled}
            onClick={() => setSkipOpen(true)}
          >
            ¿No puedes hablar?
          </button>
        </div>
      </div>

      {skipOpen ? (
        <SkipSpeakModal
          onCancel={() => setSkipOpen(false)}
          onConfirm={() => {
            setSkipOpen(false)
            clearSettleTimer()
            teardownRecognition()
            onSkipSpeak()
          }}
        />
      ) : null}
    </div>
  )
}

function SkipSpeakModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skip-speak-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
        <h2
          id="skip-speak-title"
          className="text-xl font-bold tracking-tight"
        >
          ¿Saltar ejercicios de voz?
        </h2>
        <p className="mt-3 text-sm text-orange-950/80">
          En este entrenamiento no harás los ejercicios de voz. El progreso se
          contará como si los hubieras completado.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-orange-700 hover:bg-orange-800"
            onClick={onConfirm}
          >
            Continuar sin voz
          </Button>
        </div>
      </div>
    </div>
  )
}
