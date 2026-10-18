import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export function WordRow({
  spanish,
  russian,
  progress,
  trailing,
}: {
  spanish: string
  russian: string
  progress: number
  trailing?: ReactNode
}) {
  const mastered = progress >= 100

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 py-3.5">
      <span className="shrink-0" aria-hidden>
        {mastered ? (
          <span className="grid size-5 place-items-center rounded-full bg-orange-700 text-white">
            <Check className="size-3 stroke-[3]" />
          </span>
        ) : (
          <span className="block size-5 rounded-full border border-dashed border-orange-300" />
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="font-medium text-orange-950">{spanish}</span>
        <span
          className="min-w-4 flex-1 border-b border-dotted border-orange-200"
          aria-hidden
        />
      </span>
      <span className="flex min-w-0 items-center gap-4 text-orange-900/55">
        <span className="min-w-0">
          {russian}
          <span className="sr-only">
            {mastered ? ', dominada' : `, progreso ${progress}%`}
          </span>
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </span>
    </li>
  )
}
