import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiError } from '../../shared/api/auth'
import { getTrainerSession } from '../../shared/api/training'
import { playFeedbackSound } from '../../shared/feedback-sound'
import { speakSpanish } from '../../shared/speech'
import { AnswerResultScreen } from './AnswerResultScreen'
import { Exercise1Screen } from './Exercise1Screen'
import { Exercise2Screen } from './Exercise2Screen'
import { Exercise3Screen } from './Exercise3Screen'
import { Exercise4Screen } from './Exercise4Screen'
import { Exercise5Screen } from './Exercise5Screen'
import { buildSessionQueue } from './session-queue'
import { WordDetailCard } from './WordDetailCard'

const TRAINER_SESSION_QUERY_KEY = (id: string) =>
  ['training', 'session', id] as const

export function TrainerSessionPage() {
  const { trainerId = '' } = useParams()
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [stepAnswered, setStepAnswered] = useState(false)
  const [answerResult, setAnswerResult] = useState<{
    correct: boolean
    accentWarning?: string
    /** False for exercise 2 — self-assessment never affects progress. */
    countsTowardProgress: boolean
    /** False for exercise 2 — never append a retry to the queue. */
    enqueueRetry: boolean
  } | null>(null)
  const [exitOpen, setExitOpen] = useState(false)

  const sessionQuery = useQuery({
    queryKey: TRAINER_SESSION_QUERY_KEY(trainerId),
    queryFn: ({ signal }) => getTrainerSession(trainerId, signal),
    enabled: Boolean(trainerId),
  })

  const queue = useMemo(
    () =>
      sessionQuery.data ? buildSessionQueue(sessionQuery.data.words) : [],
    [sessionQuery.data],
  )

  const currentStep = queue[stepIndex] ?? null

  useEffect(() => {
    if (currentStep?.kind !== 'intro') {
      return
    }
    speakSpanish(currentStep.word.spanish)
  }, [currentStep])

  useEffect(() => {
    if (!sessionQuery.isSuccess) {
      return
    }
    if (queue.length === 0) {
      void navigate('/', { replace: true })
    }
  }, [sessionQuery.isSuccess, queue.length, navigate])

  const handleContinue = useCallback(() => {
    playFeedbackSound('tap')
    if (stepIndex >= queue.length - 1) {
      void navigate('/', { replace: true })
      return
    }
    setAnswerResult(null)
    setStepAnswered(false)
    setStepIndex((value) => value + 1)
  }, [navigate, queue.length, stepIndex])

  const handleRevealResult = useCallback(
    (result: { correct: boolean; accentWarning?: string }) => {
      const isSelfAssessment =
        currentStep?.kind === 'exercise' && currentStep.type === 2
      setStepAnswered(true)
      setAnswerResult({
        correct: result.correct,
        accentWarning: result.accentWarning,
        // Type 2: no progress impact, no end-of-queue retry (product §10.2).
        countsTowardProgress: !isSelfAssessment,
        enqueueRetry: !isSelfAssessment && !result.correct,
      })
    },
    [currentStep],
  )

  if (sessionQuery.isPending) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6 sm:px-8">
        <p className="text-sm text-orange-900/70">Cargando entrenamiento…</p>
      </main>
    )
  }

  if (sessionQuery.isError) {
    const notFound =
      sessionQuery.error instanceof ApiError &&
      sessionQuery.error.status === 404

    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6 sm:px-8">
        <p role="alert" className="text-sm text-red-700">
          {notFound
            ? 'Este entrenamiento no está disponible.'
            : 'No se pudo cargar el entrenamiento.'}
        </p>
        <Button
          type="button"
          className="mt-4 bg-orange-700 hover:bg-orange-800"
          onClick={() => void navigate('/')}
        >
          Volver al inicio
        </Button>
      </main>
    )
  }

  if (!currentStep) {
    return null
  }

  const progress =
    queue.length === 0
      ? 0
      : Math.min(1, (stepIndex + (stepAnswered ? 1 : 0)) / queue.length)

  const showExercise1 =
    currentStep.kind === 'exercise' &&
    currentStep.type === 1 &&
    answerResult === null

  const showExercise2 =
    currentStep.kind === 'exercise' &&
    currentStep.type === 2 &&
    answerResult === null

  const showExercise3 =
    currentStep.kind === 'exercise' &&
    currentStep.type === 3 &&
    answerResult === null

  const showExercise4 =
    currentStep.kind === 'exercise' &&
    currentStep.type === 4 &&
    answerResult === null

  const showExercise5 =
    currentStep.kind === 'exercise' &&
    currentStep.type === 5 &&
    answerResult === null

  const showAnswerResult =
    currentStep.kind === 'exercise' && answerResult !== null

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col bg-orange-50/40">
      <header className="flex shrink-0 items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6">
        <button
          type="button"
          aria-label="Cerrar"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-orange-900 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
          onClick={() => setExitOpen(true)}
        >
          <X className="size-5" aria-hidden />
        </button>
        <div
          className="mx-1 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-orange-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Progreso del entrenamiento"
        >
          <div
            className="h-full rounded-full bg-orange-600 transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </header>

      {currentStep.kind === 'intro' ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-8">
            <WordDetailCard word={currentStep.word} />
          </div>
          <div className="shrink-0 border-t border-orange-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
            <Button
              type="button"
              className="h-11 w-full bg-orange-700 text-base hover:bg-orange-800"
              onClick={() => {
                setStepAnswered(true)
                handleContinue()
              }}
            >
              Vale
            </Button>
          </div>
        </>
      ) : null}

      {showExercise1 ? (
        <Exercise1Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
          onAnsweredChange={setStepAnswered}
        />
      ) : null}

      {showExercise2 ? (
        <Exercise2Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
          onAnsweredChange={setStepAnswered}
        />
      ) : null}

      {showExercise3 ? (
        <Exercise3Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
          onAnsweredChange={setStepAnswered}
        />
      ) : null}

      {showExercise4 ? (
        <Exercise4Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
          onAnsweredChange={setStepAnswered}
        />
      ) : null}

      {showExercise5 ? (
        <Exercise5Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
          onAnsweredChange={setStepAnswered}
        />
      ) : null}

      {showAnswerResult && answerResult ? (
        <AnswerResultScreen
          key={`result:${currentStep.id}`}
          word={currentStep.word}
          correct={answerResult.correct}
          accentWarning={answerResult.accentWarning}
          showIncorrectBanner={currentStep.type !== 2}
          onDone={handleContinue}
        />
      ) : null}

      {exitOpen ? (
        <ExitConfirmModal
          onCancel={() => setExitOpen(false)}
          onConfirm={() => {
            setExitOpen(false)
            void navigate('/')
          }}
        />
      ) : null}
    </main>
  )
}

function ExitConfirmModal({
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
      aria-labelledby="exit-training-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
        <h2
          id="exit-training-title"
          className="text-xl font-bold tracking-tight"
        >
          ¿Salir del entrenamiento?
        </h2>
        <p className="mt-3 text-sm text-orange-950/80">
          Perderás el progreso de este entrenamiento.
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
            Salir
          </Button>
        </div>
      </div>
    </div>
  )
}
