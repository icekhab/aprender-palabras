import { Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { playFeedbackSound } from '../../shared/feedback-sound'
import { speakWord } from '../../shared/speech'
import { FEEDBACK_HOLD_MS } from './feedback'

type SelfAssessment = 'remember' | 'forgot'

export function Exercise2Screen({
  word,
  onRevealResult,
  onAnsweredChange,
}: {
  word: TrainerSessionWord
  onRevealResult: (result: { correct: boolean }) => void
  onAnsweredChange?: (answered: boolean) => void
}) {
  const [selected, setSelected] = useState<SelfAssessment | null>(null)

  useEffect(() => {
    speakWord(word.wordId)
  }, [word.wordId])

  useEffect(() => {
    if (selected === null) {
      return
    }

    const correct = selected === 'remember'
    const timer = window.setTimeout(() => {
      onRevealResult({ correct })
    }, FEEDBACK_HOLD_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [selected, onRevealResult])

  const answered = selected !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col items-center gap-6 px-5 pt-16 sm:px-8">
        <button
          type="button"
          aria-label="Escuchar"
          className="inline-flex size-28 cursor-pointer items-center justify-center rounded-full bg-orange-600 text-white shadow-md transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 sm:size-32"
          onClick={() => {
            speakWord(word.wordId)
          }}
        >
          <Volume2 className="size-12 sm:size-14" aria-hidden />
        </button>
        <p className="max-w-xs text-center text-xl font-semibold tracking-tight text-orange-950 sm:text-2xl">
          Escucha y recuerda la palabra
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-5 pt-6 pb-[max(3rem,calc(env(safe-area-inset-bottom)+2rem))] sm:px-8">
        {(
          [
            {
              id: 'remember' as const,
              label: 'Recuerdo',
              correct: true,
              idle: 'bg-emerald-500 text-white hover:bg-emerald-600',
              selectedTone: 'bg-emerald-600 text-white',
              otherTone: 'bg-emerald-500/40 text-white/70',
            },
            {
              id: 'forgot' as const,
              label: 'No recuerdo',
              correct: false,
              idle: 'bg-rose-400 text-white hover:bg-rose-500',
              selectedTone: 'bg-rose-500 text-white',
              otherTone: 'bg-rose-400/40 text-white/70',
            },
          ] as const
        ).map((option) => {
          const isSelected = selected === option.id
          let tone: string = option.idle

          if (answered) {
            if (isSelected) {
              tone = option.selectedTone
            } else {
              tone = option.otherTone
            }
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={answered}
              className={`h-14 w-full cursor-pointer rounded-2xl text-center text-lg font-semibold transition disabled:cursor-default focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 ${tone}`}
              onClick={() => {
                setSelected(option.id)
                onAnsweredChange?.(true)
                playFeedbackSound(option.correct ? 'correct' : 'incorrect')
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
