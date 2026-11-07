import type { WordGenerationStatus } from '@aprender-palabras/contracts'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProgressDot } from './progress-dot'

export function WordRow({
  spanish,
  russian,
  progress,
  generationStatus = 'ready',
  trailing,
  onSelect,
}: {
  spanish: string
  russian: string
  progress: number
  generationStatus?: WordGenerationStatus
  trailing?: ReactNode
  onSelect?: () => void
}) {
  const mastered = progress >= 100
  const isGenerating = generationStatus === 'generating'
  const isFailed = generationStatus === 'failed'
  const rowTitle = isGenerating
    ? 'Generándose, espere…'
    : isFailed
      ? 'No se pudo generar la tarjeta'
      : undefined

  return (
    <li
      className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 py-3.5"
      title={rowTitle}
    >
      <span className="shrink-0" aria-hidden>
        {isGenerating ? (
          <LoaderCircle
            className="size-5 animate-spin text-orange-500"
            strokeWidth={2.25}
          />
        ) : isFailed ? (
          <AlertCircle
            className="size-5 text-red-600"
            strokeWidth={2.25}
          />
        ) : (
          <ProgressDot progress={progress} />
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        {onSelect ? (
          <button
            type="button"
            className="cursor-pointer truncate font-medium text-orange-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
            onClick={onSelect}
          >
            {spanish}
          </button>
        ) : (
          <span className="truncate font-medium text-orange-950">{spanish}</span>
        )}
        <span
          className="min-w-4 flex-1 border-b border-dotted border-orange-200"
          aria-hidden
        />
      </span>
      <span className="flex min-w-0 items-center gap-4 text-orange-900/55">
        <span className="min-w-0">
          {russian}
          <span className="sr-only">
            {isGenerating
              ? ', generándose'
              : isFailed
                ? ', error de generación'
                : mastered
                  ? ', dominada'
                  : `, progreso ${progress}%`}
          </span>
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </span>
    </li>
  )
}
