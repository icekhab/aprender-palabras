import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthUser } from '@aprender-palabras/contracts'
import { X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiError } from '../../shared/api/auth'
import {
  completeTrainerSession,
  getTrainerSession,
} from '../../shared/api/training'
import { playFeedbackSound } from '../../shared/feedback-sound'
import { speakSpanish } from '../../shared/speech'
import { AnswerResultScreen } from './AnswerResultScreen'
import {
  CompletionScreen,
  displayNameFromLogin,
} from './CompletionScreen'
import { Exercise1Screen } from './Exercise1Screen'
import { Exercise2Screen } from './Exercise2Screen'
import { Exercise3Screen } from './Exercise3Screen'
import { Exercise4Screen } from './Exercise4Screen'
import { Exercise5Screen } from './Exercise5Screen'
import {
  attemptKey,
  buildSessionQueue,
  createRetryStep,
  MAX_ATTEMPTS_PER_EXERCISE,
  type SessionStep,
} from './session-queue'
import { WordDetailCard } from './WordDetailCard'

const TRAINER_SESSION_QUERY_KEY = (id: string) =>
  ['training', 'session', id] as const
const TRAINING_TODAY_QUERY_KEY = ['training', 'today'] as const
const AUTH_QUERY_KEY = ['auth', 'me'] as const

type CompletionSummary = {
  wordCount: number
  dailyTotal: number
  dailyCompleted: number
  nextTrainerId: string | null
  error: string | null
}

export function TrainerSessionPage() {
  const { trainerId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const [stepIndex, setStepIndex] = useState(0)
  const [queue, setQueue] = useState<SessionStep[]>([])
  const [queueReady, setQueueReady] = useState(false)
  /** Steps closed so far (intro / resolved exercise). Drives the session bar. */
  const [completedCount, setCompletedCount] = useState(0)
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>(
    {},
  )
  /** Wrong attempts for types 1/3/4/5 per card — sent on complete. */
  const [errorCounts, setErrorCounts] = useState<Record<string, number>>({})
  const [answerResult, setAnswerResult] = useState<{
    correct: boolean
    accentWarning?: string
    /** False for exercise 2 — self-assessment never affects card progress. */
    countsTowardProgress: boolean
    /** False for exercise 2 — never append a retry to the queue. */
    enqueueRetry: boolean
  } | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [completion, setCompletion] = useState<CompletionSummary | null>(null)
  const [saving, setSaving] = useState(false)

  const sessionQuery = useQuery({
    queryKey: TRAINER_SESSION_QUERY_KEY(trainerId),
    queryFn: ({ signal }) => getTrainerSession(trainerId, signal),
    enabled: Boolean(trainerId),
  })

  useEffect(() => {
    if (!sessionQuery.data) {
      return
    }
    setQueue(buildSessionQueue(sessionQuery.data.words))
    setQueueReady(true)
    setStepIndex(0)
    setCompletedCount(0)
    setAnswerResult(null)
    setAttemptCounts({})
    setErrorCounts({})
    setCompletion(null)
    setSaving(false)
  }, [sessionQuery.data])

  const currentStep = queue[stepIndex] ?? null

  useEffect(() => {
    if (currentStep?.kind !== 'intro') {
      return
    }
    speakSpanish(currentStep.word.spanish)
  }, [currentStep])

  useEffect(() => {
    if (!sessionQuery.isSuccess || !queueReady) {
      return
    }
    if (queue.length === 0) {
      void navigate('/', { replace: true })
    }
  }, [sessionQuery.isSuccess, queueReady, queue.length, navigate])

  const isCurrentStepResolved = useCallback((): boolean => {
    if (!currentStep) {
      return false
    }
    if (currentStep.kind === 'intro') {
      return true
    }
    if (currentStep.type === 2) {
      return true
    }
    if (!answerResult) {
      return false
    }
    if (answerResult.correct) {
      return true
    }
    const key = attemptKey(currentStep.word.userCardId, currentStep.type)
    return (attemptCounts[key] ?? 0) >= MAX_ATTEMPTS_PER_EXERCISE
  }, [answerResult, attemptCounts, currentStep])

  const submitCompletion = useCallback(async () => {
    if (!sessionQuery.data) {
      return
    }
    setSaving(true)
    setCompletion((prev) =>
      prev
        ? { ...prev, error: null }
        : {
            wordCount: 0,
            dailyTotal: 0,
            dailyCompleted: 0,
            nextTrainerId: null,
            error: null,
          },
    )
    try {
      const result = await completeTrainerSession(trainerId, {
        cards: sessionQuery.data.words.map((word) => ({
          userCardId: word.userCardId,
          errorCount: errorCounts[word.userCardId] ?? 0,
        })),
      })
      setCompletion({
        wordCount: result.wordCount,
        dailyTotal: result.dailyTotal,
        dailyCompleted: result.dailyCompleted,
        nextTrainerId: result.nextTrainerId,
        error: null,
      })
      void queryClient.invalidateQueries({
        queryKey: TRAINING_TODAY_QUERY_KEY,
      })
    } catch {
      setCompletion((prev) => ({
        wordCount: prev?.wordCount ?? 0,
        dailyTotal: prev?.dailyTotal ?? 0,
        dailyCompleted: prev?.dailyCompleted ?? 0,
        nextTrainerId: prev?.nextTrainerId ?? null,
        error: 'No se pudo guardar el progreso. Inténtalo de nuevo.',
      }))
    } finally {
      setSaving(false)
    }
  }, [errorCounts, queryClient, sessionQuery.data, trainerId])

  const handleContinue = useCallback(() => {
    playFeedbackSound('tap')

    if (isCurrentStepResolved()) {
      setCompletedCount((value) => value + 1)
    }

    let nextQueue = queue
    if (
      answerResult?.enqueueRetry &&
      currentStep?.kind === 'exercise'
    ) {
      const key = attemptKey(currentStep.word.userCardId, currentStep.type)
      const attempts = attemptCounts[key] ?? 0
      if (attempts < MAX_ATTEMPTS_PER_EXERCISE) {
        nextQueue = [...queue, createRetryStep(currentStep, attempts)]
        setQueue(nextQueue)
      }
    }

    if (stepIndex >= nextQueue.length - 1) {
      setCompletion({
        wordCount: 0,
        dailyTotal: 0,
        dailyCompleted: 0,
        nextTrainerId: null,
        error: null,
      })
      void submitCompletion()
      return
    }
    setAnswerResult(null)
    setStepIndex((value) => value + 1)
  }, [
    answerResult,
    attemptCounts,
    currentStep,
    isCurrentStepResolved,
    queue,
    stepIndex,
    submitCompletion,
  ])

  const handleRevealResult = useCallback(
    (result: { correct: boolean; accentWarning?: string }) => {
      const isSelfAssessment =
        currentStep?.kind === 'exercise' && currentStep.type === 2
      const countsTowardProgress = !isSelfAssessment
      const enqueueRetry = countsTowardProgress && !result.correct

      if (currentStep?.kind === 'exercise') {
        const key = attemptKey(currentStep.word.userCardId, currentStep.type)
        setAttemptCounts((prev) => ({
          ...prev,
          [key]: (prev[key] ?? 0) + 1,
        }))
        if (countsTowardProgress && !result.correct) {
          const cardId = currentStep.word.userCardId
          setErrorCounts((prev) => ({
            ...prev,
            [cardId]: (prev[cardId] ?? 0) + 1,
          }))
        }
      }

      setAnswerResult({
        correct: result.correct,
        accentWarning: result.accentWarning,
        countsTowardProgress,
        enqueueRetry,
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

  if (completion) {
    return (
      <CompletionScreen
        userName={displayNameFromLogin(user?.login ?? '')}
        wordCount={completion.wordCount}
        dailyTotal={completion.dailyTotal}
        dailyCompleted={completion.dailyCompleted}
        nextTrainerId={completion.nextTrainerId}
        saving={saving}
        error={completion.error}
        onRetry={() => {
          void submitCompletion()
        }}
        onContinue={() => {
          if (!completion.nextTrainerId) {
            return
          }
          void navigate(`/entrenamiento/${completion.nextTrainerId}`, {
            replace: true,
          })
        }}
        onHome={() => {
          void navigate('/', { replace: true })
        }}
      />
    )
  }

  if (!currentStep) {
    return null
  }

  const remainingMin = Math.max(0, queue.length - stepIndex)
  const progress =
    completedCount + remainingMin === 0
      ? 0
      : completedCount / (completedCount + remainingMin)

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
              onClick={handleContinue}
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
        />
      ) : null}

      {showExercise2 ? (
        <Exercise2Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
        />
      ) : null}

      {showExercise3 ? (
        <Exercise3Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
        />
      ) : null}

      {showExercise4 ? (
        <Exercise4Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
        />
      ) : null}

      {showExercise5 ? (
        <Exercise5Screen
          key={currentStep.id}
          word={currentStep.word}
          onRevealResult={handleRevealResult}
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
