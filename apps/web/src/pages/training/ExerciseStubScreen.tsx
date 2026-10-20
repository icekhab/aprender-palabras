import { Button } from '@/components/ui/button'
import type { ExerciseType } from './session-queue'

const TYPE_LABELS: Record<ExerciseType, string> = {
  1: 'Español → ruso',
  2: 'Audio → autoevaluación',
  3: 'Ruso → español (opción)',
  4: 'Audio → escritura',
  5: 'Ruso → español (escritura)',
}

export function ExerciseStubScreen({
  type,
  spanish,
  onContinue,
}: {
  type: ExerciseType
  spanish: string
  onContinue: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 sm:px-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-orange-900/70">
          Ejercicio {type}
        </p>
        <p className="text-2xl font-bold tracking-tight text-orange-950">
          {spanish}
        </p>
        <p className="max-w-sm text-sm text-orange-900/60">
          {TYPE_LABELS[type]} — próximamente.
        </p>
      </div>
      <div className="shrink-0 border-t border-orange-100 bg-white px-0 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          className="h-11 w-full bg-orange-700 text-base hover:bg-orange-800"
          onClick={onContinue}
        >
          Vale
        </Button>
      </div>
    </div>
  )
}
