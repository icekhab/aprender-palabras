import { Frown, Info } from 'lucide-react'
import { useEffect } from 'react'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { Button } from '@/components/ui/button'
import { speakWord } from '../../shared/speech'
import { WordDetailCard } from './WordDetailCard'

export function AnswerResultScreen({
  word,
  correct,
  accentWarning,
  showIncorrectBanner = true,
  onDone,
}: {
  word: TrainerSessionWord
  correct: boolean
  /** Canonical spelling when the answer matched without required accents. */
  accentWarning?: string
  /** Self-assessment (type 2) shows the same card without this banner. */
  showIncorrectBanner?: boolean
  onDone: () => void
}) {
  useEffect(() => {
    speakWord(word.wordId)
  }, [word.wordId])

  const showAccentWarning = correct && Boolean(accentWarning)
  const showIncorrect = !correct && showIncorrectBanner

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-8">
        <WordDetailCard word={word} />
      </div>

      <div className="shrink-0 border-t border-orange-100 bg-white px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:px-8">
        <div className="flex flex-col gap-3">
          {showAccentWarning ? (
            <div
              className="flex items-center gap-3 rounded-2xl bg-orange-100 px-4 py-3 text-orange-950"
              role="status"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-200">
                <Info className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-medium">
                Ortografía correcta: {accentWarning}
              </p>
            </div>
          ) : null}

          {showIncorrect ? (
            <div
              className="flex items-center gap-3 rounded-2xl bg-orange-950 px-4 py-3 text-white"
              role="status"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-500/90">
                <Frown className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-medium">Tu respuesta es incorrecta</p>
            </div>
          ) : null}

          <Button
            type="button"
            className="h-11 w-full bg-orange-700 text-base hover:bg-orange-800"
            onClick={onDone}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
