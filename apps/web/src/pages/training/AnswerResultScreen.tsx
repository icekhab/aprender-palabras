import { Frown } from 'lucide-react'
import { useEffect } from 'react'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { Button } from '@/components/ui/button'
import { speakSpanish } from '../../shared/speech'
import { WordDetailCard } from './WordDetailCard'

export function AnswerResultScreen({
  word,
  correct,
  onDone,
}: {
  word: TrainerSessionWord
  correct: boolean
  onDone: () => void
}) {
  useEffect(() => {
    speakSpanish(word.spanish)
  }, [word])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-8">
        <WordDetailCard word={word} />
      </div>

      {!correct ? (
        <div className="shrink-0 px-5 sm:px-8">
          <div
            className="flex items-center gap-3 rounded-2xl bg-orange-950 px-4 py-3 text-white"
            role="status"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-500/90">
              <Frown className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">Tu respuesta es incorrecta</p>
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-orange-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <Button
          type="button"
          className="h-11 w-full bg-orange-700 text-base hover:bg-orange-800"
          onClick={onDone}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
