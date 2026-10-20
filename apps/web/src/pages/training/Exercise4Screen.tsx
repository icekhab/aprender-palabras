import { Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { Button } from '@/components/ui/button'
import { playFeedbackSound } from '../../shared/feedback-sound'
import { speakSpanish } from '../../shared/speech'
import { FEEDBACK_HOLD_MS } from './feedback'
import { compareSpanishAnswer } from './spanish-answer'

export function Exercise4Screen({
  word,
  onRevealResult,
  onAnsweredChange,
}: {
  word: TrainerSessionWord
  onRevealResult: (result: { correct: boolean; accentWarning?: string }) => void
  onAnsweredChange?: (answered: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [outcome, setOutcome] = useState<{
    correct: boolean
    accentWarning?: string
  } | null>(null)

  useEffect(() => {
    speakSpanish(word.spanish)
  }, [word.spanish])

  useEffect(() => {
    inputRef.current?.focus()
  }, [word.userCardId])

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

  const canSubmit = value.trim().length > 0 && !submitted

  function submit() {
    if (!canSubmit) {
      return
    }

    const result = compareSpanishAnswer(word.spanish, value)
    setSubmitted(true)
    setOutcome(result)
    onAnsweredChange?.(true)
    playFeedbackSound(result.correct ? 'correct' : 'incorrect')
  }

  let inputTone =
    'border-orange-200 focus:border-orange-500 focus:ring-orange-200'

  if (outcome) {
    inputTone = outcome.correct
      ? 'border-green-600 bg-green-50 text-green-950'
      : 'border-red-600 bg-red-50 text-red-950'
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col items-center gap-6 px-5 pt-16 sm:px-8">
        <button
          type="button"
          aria-label="Escuchar"
          className="inline-flex size-28 cursor-pointer items-center justify-center rounded-full bg-orange-600 text-white shadow-md transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 sm:size-32"
          onClick={() => {
            speakSpanish(word.spanish)
          }}
        >
          <Volume2 className="size-12 sm:size-14" aria-hidden />
        </button>

        <input
          ref={inputRef}
          type="text"
          lang="es"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          autoComplete="off"
          disabled={submitted}
          aria-label="Escribe la palabra"
          placeholder="Escribe la palabra"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          className={`w-full max-w-sm border-0 border-b-2 bg-transparent px-1 py-3 text-center text-2xl font-semibold text-orange-950 outline-none placeholder:text-2xl placeholder:font-normal placeholder:text-orange-900/35 focus:ring-0 disabled:cursor-default ${inputTone}`}
        />

        <p className="text-center text-sm text-orange-900/50">
          Recuerda la palabra
        </p>
      </div>

      <div className="mt-auto px-5 pt-6 pb-[max(3rem,calc(env(safe-area-inset-bottom)+2rem))] sm:px-8">
        <Button
          type="button"
          disabled={!canSubmit}
          className="h-14 w-full bg-emerald-500 text-lg font-semibold text-white hover:bg-emerald-600 disabled:bg-emerald-500/40"
          onClick={submit}
        >
          Comprobar
        </Button>
      </div>
    </div>
  )
}
