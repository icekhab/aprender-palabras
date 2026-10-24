import { Check, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  playFeedbackSound,
  stopFeedbackSound,
} from '../../shared/feedback-sound'

export function CompletionScreen({
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
    <main className="relative mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-orange-50 text-orange-950">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-200/70 via-orange-50 to-transparent"
        aria-hidden
      />

      <header className="relative z-10 flex shrink-0 items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-6">
        <button
          type="button"
          aria-label="Cerrar"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-orange-900/50 hover:bg-orange-100/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
          onClick={leaveHome}
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-4 sm:px-8">
        <div className="mx-auto my-auto w-full max-w-sm text-center">
          <div
            className="mx-auto grid size-24 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_12px_40px_-12px_rgba(16,185,129,0.45)]"
            aria-hidden
          >
            <Check className="size-12 stroke-[2.5]" />
          </div>

          <h1 className="mt-8 text-3xl font-bold tracking-tight text-orange-950">
            {dayFinished ? '¡Día completado!' : '¡Bien hecho!'}
          </h1>

          {saving ? (
            <p className="mt-4 text-sm text-orange-900/60">
              Guardando progreso…
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {ready ? (
            <>
              <p className="mt-4 text-lg text-orange-900/70">
                Has repasado{' '}
                <span className="font-semibold text-orange-800">
                  {wordCount} {wordCount === 1 ? 'palabra' : 'palabras'}
                </span>
              </p>

              {dayFinished ? (
                <p className="mt-3 text-base text-orange-900/55">
                  Has terminado el entrenamiento diario.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-orange-900/45">¡Ya casi!</p>
                  <ol className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    {Array.from({ length: dailyTotal }, (_, index) => {
                      const done = index < dailyCompleted
                      return (
                        <li
                          key={index}
                          className={`grid size-11 place-items-center rounded-full text-sm font-semibold transition-colors ${
                            done
                              ? 'bg-orange-700 text-white'
                              : 'bg-white text-orange-900/40 ring-1 ring-orange-200'
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

      <div className="relative z-10 shrink-0 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:px-8">
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
