import { useEffect, useMemo, useState } from 'react'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { playFeedbackSound } from '../../shared/feedback-sound'
import { buildExercise3Step } from './exercise3'
import { FEEDBACK_HOLD_MS } from './feedback'

export function Exercise3Screen({
  word,
  onRevealResult,
  onAnsweredChange,
}: {
  word: TrainerSessionWord
  onRevealResult: (result: { correct: boolean }) => void
  onAnsweredChange?: (answered: boolean) => void
}) {
  const step = useMemo(() => buildExercise3Step(word), [word])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (selected === null) {
      return
    }

    const correct = selected === step.correctSpanish
    const timer = window.setTimeout(() => {
      onRevealResult({ correct })
    }, FEEDBACK_HOLD_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [selected, step.correctSpanish, onRevealResult])

  const answered = selected !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col items-center gap-5 px-5 pt-8 sm:px-8">
        <p className="text-center text-3xl font-bold tracking-tight text-orange-950">
          {step.russian}
        </p>
      </div>

      <div className="mt-auto flex flex-col px-5 pt-6 pb-[max(3rem,calc(env(safe-area-inset-bottom)+2rem))] sm:px-8">
        <p className="text-center text-sm text-orange-900/50">
          Elige la traducción
        </p>

        <ul className="mt-4 flex flex-col gap-3">
          {step.options.map((option) => {
            const isSelected = selected === option
            const isAnswer = option === step.correctSpanish
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
                    const correct = option === step.correctSpanish
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
