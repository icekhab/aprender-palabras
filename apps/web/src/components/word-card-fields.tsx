import {
  isDisplayablePartOfSpeech,
  type WordDraft,
} from '@aprender-palabras/contracts'
import { Pencil } from 'lucide-react'
import { SpeakButton } from '@/components/speak-button'
import { UnsplashAttribution } from '@/components/unsplash-attribution'
import { ProgressRing } from '@/pages/lessons/progress-ring'

export type WordCardFieldsData = Pick<
  WordDraft,
  | 'spanish'
  | 'russian'
  | 'definitionEs'
  | 'examples'
  | 'partOfSpeech'
  | 'gender'
  | 'wrongRussian'
  | 'wrongSpanish'
  | 'imageUrl'
  | 'imagePhotographerName'
  | 'imagePhotographerUrl'
  | 'imagePageUrl'
>

export function WordCardFields({
  draft,
  wordId,
  progress,
  onProgressDoubleClick,
  onEdit,
}: {
  draft: WordCardFieldsData
  wordId?: string | null
  progress?: number
  onProgressDoubleClick?: () => void
  onEdit?: () => void
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-start gap-3">
        {wordId ? (
          <span className="inline-flex h-[1lh] shrink-0 items-center text-3xl font-bold leading-tight">
            <SpeakButton wordId={wordId} size="lg" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 text-3xl font-bold tracking-tight leading-tight">
              {draft.spanish}
            </p>
            {onEdit ? (
              <button
                type="button"
                aria-label="Editar palabra"
                className="mt-1 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-orange-700 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
                onClick={onEdit}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-lg text-orange-900/80">{draft.russian}</p>
        </div>
        {progress !== undefined ? (
          onProgressDoubleClick ? (
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
              title="Doble clic para reiniciar el progreso"
              aria-label={`Progreso ${progress}%. Doble clic para reiniciar.`}
              onDoubleClick={onProgressDoubleClick}
            >
              <span aria-hidden>
                <ProgressRing value={progress} />
              </span>
            </button>
          ) : (
            <ProgressRing value={progress} />
          )
        ) : null}
      </div>

      {draft.imageUrl ? (
        <figure>
          <img
            src={draft.imageUrl}
            alt=""
            className="max-h-80 w-full rounded-2xl object-cover"
          />
          {draft.imagePhotographerName && draft.imagePhotographerUrl ? (
            <UnsplashAttribution
              photographerName={draft.imagePhotographerName}
              photographerUrl={draft.imagePhotographerUrl}
              variant="caption"
            />
          ) : null}
        </figure>
      ) : null}

      <ReadOnlyField label="Definición" value={draft.definitionEs} />
      <div>
        <p className="text-sm font-medium text-orange-900/70">Ejemplos</p>
        {draft.examples.length > 0 ? (
          <ul className="mt-1 space-y-2">
            {draft.examples.map((example) => (
              <li key={example}>
                <p className="leading-6 text-orange-950">{example}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-orange-900/40">Sin datos</p>
        )}
      </div>
      {isDisplayablePartOfSpeech(draft.partOfSpeech) ? (
        <ReadOnlyField
          label="Categoría gramatical"
          value={draft.partOfSpeech}
        />
      ) : null}
      {draft.gender ? (
        <ReadOnlyField
          label="Género"
          value={
            draft.gender === 'masculine' ? 'masculino' : 'femenino'
          }
        />
      ) : null}
      <ReadOnlyField
        label="Opciones incorrectas (ruso)"
        value={
          draft.wrongRussian.length > 0 ? draft.wrongRussian.join(', ') : null
        }
      />
      <ReadOnlyField
        label="Opciones incorrectas (español)"
        value={
          draft.wrongSpanish.length > 0 ? draft.wrongSpanish.join(', ') : null
        }
      />
    </section>
  )
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div>
      <p className="text-sm font-medium text-orange-900/70">{label}</p>
      {value ? (
        <p className="mt-1 text-orange-950">{value}</p>
      ) : (
        <p className="mt-1 text-sm text-orange-900/40">Sin datos</p>
      )}
    </div>
  )
}
