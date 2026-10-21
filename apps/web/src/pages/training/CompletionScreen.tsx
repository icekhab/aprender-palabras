import { Check, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  playFeedbackSound,
  stopFeedbackSound,
} from '../../shared/feedback-sound'

export function CompletionScreen({
  userName,
  wordCount,
  dailyTotal,
  dailyCompleted,
  nextTrainerId,
  saving,
  error,
  onRetry,
  onContinue,
  onHome,
}: {
  userName: string
  wordCount: number
  dailyTotal: number
  dailyCompleted: number
  nextTrainerId: string | null
  saving: boolean
  error: string | null
  onRetry: () => void
  onContinue: () => void
  onHome: () => void
}) {
  const winPlayed = useRef(false)
  /** All daily slots done — ignore extra nextTrainerId (shown on home instead). */
  const dayFinished =
    !saving && !error && dailyTotal > 0 && dailyCompleted >= dailyTotal
  const ready = !saving && !error && wordCount > 0
  const canContinue = Boolean(nextTrainerId) && !dayFinished

  useEffect(() => {
    if (!ready || winPlayed.current) {
      return
    }
    winPlayed.current = true
    playFeedbackSound('win')
  }, [ready])

  useEffect(() => {
    return () => {
      stopFeedbackSound()
    }
  }, [])

  function leaveHome() {
    stopFeedbackSound()
    onHome()
  }

  function leaveContinue() {
    stopFeedbackSound()
    onContinue()
  }

  function leaveRetry() {
    stopFeedbackSound()
    onRetry()
  }

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col bg-stone-100">
      <header className="flex shrink-0 items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-6">
        <button
          type="button"
          aria-label="Cerrar"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
          onClick={leaveHome}
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 sm:px-8">
        <div className="mx-auto my-auto w-full max-w-sm rounded-3xl bg-white px-6 py-8 shadow-sm">
          <div
            className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500 text-white"
            aria-hidden
          >
            <Check className="size-10 stroke-[2.5]" />
          </div>

          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-stone-900">
            {userName}, ¡sigue así!
          </h1>

          {saving ? (
            <p className="mt-3 text-center text-sm text-stone-500">
              Guardando progreso…
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-center text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {ready ? (
            <>
              <p className="mt-3 text-center text-base text-stone-600">
                Has repasado{' '}
                <span className="font-semibold text-sky-600">
                  {wordCount} {wordCount === 1 ? 'palabra' : 'palabras'}
                </span>
              </p>

              {dayFinished ? (
                <p className="mt-8 text-center text-lg font-medium text-stone-800">
                  ¡Has terminado el entrenamiento diario! 🎉
                </p>
              ) : (
                <>
                  <p className="mt-2 text-center text-sm text-stone-400">
                    ¡Ya casi!
                  </p>
                  <ol className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    {Array.from({ length: dailyTotal }, (_, index) => {
                      const done = index < dailyCompleted
                      return (
                        <li
                          key={index}
                          className={`grid size-11 place-items-center rounded-full text-sm font-semibold ${
                            done
                              ? 'bg-emerald-500 text-white'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                          aria-label={
                            done
                              ? `Entrenamiento ${index + 1} completado`
                              : `Entrenamiento ${index + 1}`
                          }
                        >
                          {done ? (
                            <Check className="size-5" aria-hidden />
                          ) : (
                            index + 1
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        {error ? (
          <Button
            type="button"
            className="h-12 w-full bg-orange-700 text-base hover:bg-orange-800"
            disabled={saving}
            onClick={leaveRetry}
          >
            {saving ? 'Guardando…' : 'Reintentar'}
          </Button>
        ) : dayFinished || !canContinue ? (
          <Button
            type="button"
            className="h-12 w-full bg-orange-700 text-base hover:bg-orange-800"
            disabled={saving}
            onClick={leaveHome}
          >
            Terminar
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 w-full bg-orange-700 text-base hover:bg-orange-800"
            disabled={saving || !ready}
            onClick={leaveContinue}
          >
            {saving ? 'Guardando…' : 'Continuar'}
          </Button>
        )}
      </div>
    </main>
  )
}

export function displayNameFromLogin(login: string): string {
  const local = login.includes('@') ? login.slice(0, login.indexOf('@')) : login
  const trimmed = local.trim()
  if (!trimmed) {
    return 'Hola'
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
