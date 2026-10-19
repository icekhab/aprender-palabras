import { Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { playFeedbackSound } from '../../shared/feedback-sound'
import { speakSpanish } from '../../shared/speech'
import { buildExercise1Step } from './exercise1'
import { FEEDBACK_HOLD_MS } from './feedback'

export function Exercise1Screen({
  word,
  onRevealResult,
  onAnsweredChange,
}: {
  word: TrainerSessionWord
  onRevealResult: (result: { correct: boolean }) => void
  onAnsweredChange?: (answered: boolean) => void
}) {
  const step = useMemo(() => buildExercise1Step(word), [word])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    speakSpanish(step.spanish)
  }, [step])

  useEffect(() => {
    if (selected === null) {
      return
    }

    const correct = selected === step.correctRussian
    const timer = window.setTimeout(() => {
      onRevealResult({ correct })
    }, FEEDBACK_HOLD_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [selected, step.correctRussian, onRevealResult])

  const answered = selected !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col items-center gap-5 px-5 pt-8 sm:px-8">
        <button
          type="button"
          aria-label="Escuchar"
          className="inline-flex size-16 cursor-pointer items-center justify-center rounded-full bg-orange-700 text-white shadow-sm transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
          onClick={() => {
            speakSpanish(step.spanish)
          }}
        >
          <Volume2 className="size-7" aria-hidden />
        </button>
        <p className="text-center text-3xl font-bold tracking-tight text-orange-950">
          {step.spanish}
        </p>
      </div>

      <div className="mt-auto flex flex-col px-5 pt-6 pb-[max(3rem,calc(env(safe-area-inset-bottom)+2rem))] sm:px-8">
        <p className="text-center text-sm text-orange-900/50">
          Recuerda la palabra
        </p>

        <ul className="mt-4 flex flex-col gap-3">
          {step.options.map((option) => {
            const isSelected = selected === option
            const isAnswer = option === step.correctRussian
            let tone =
              'border-orange-100 bg-orange-50/80 text-orange-950 hover:bg-orange-100'

            if (answered) {
              if (isAnswer) {
                tone = 'border-green-600 bg-green-50 text-green-950'
              } else if (isSelected) {
                tone = 'border-red-600 bg-red-50 text-red-950'
              } else {
                tone = 'border-orange-50 bg-orange-50/40 text-orange-900/40'
              }
            }

            return (
              <li key={option}>
                <button
                  type="button"
                  disabled={answered}
                  className={`w-full cursor-pointer rounded-2xl border px-4 py-3.5 text-left text-base font-medium transition disabled:cursor-default focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 ${tone}`}
                  onClick={() => {
                    const correct = option === step.correctRussian
                    setSelected(option)
                    onAnsweredChange?.(true)
                    playFeedbackSound(correct ? 'correct' : 'incorrect')
                  }}
                >
                  {option}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
