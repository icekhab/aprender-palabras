import type { WordDraft } from '@aprender-palabras/contracts'
import { SpeakButton } from '@/components/speak-button'
import { ProgressRing } from '@/pages/lessons/progress-ring'

export type WordCardFieldsData = Pick<
  WordDraft,
  | 'spanish'
  | 'russian'
  | 'additionalTranslations'
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
  progress,
  onProgressDoubleClick,
}: {
  draft: WordCardFieldsData
  progress?: number
  onProgressDoubleClick?: () => void
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-[1lh] shrink-0 items-center text-3xl font-bold leading-tight">
          <SpeakButton text={draft.spanish} size="lg" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold tracking-tight leading-tight">
            {draft.spanish}
          </p>
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
            <figcaption className="mt-2 text-xs text-orange-900/60">
              Foto de{' '}
              <a
                href={draft.imagePhotographerUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {draft.imagePhotographerName}
              </a>
              {draft.imagePageUrl ? (
                <>
                  {' '}
                  en{' '}
                  <a
                    href={draft.imagePageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Unsplash
                  </a>
                </>
              ) : null}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <ReadOnlyField
        label="Traducciones adicionales"
        value={
          draft.additionalTranslations.length > 0
            ? draft.additionalTranslations.join(', ')
            : null
        }
      />
      <ReadOnlyField label="Definición" value={draft.definitionEs} />
      <div>
        <p className="text-sm font-medium text-orange-900/70">Ejemplos</p>
        {draft.examples.length > 0 ? (
          <ul className="mt-1 space-y-2">
            {draft.examples.map((example) => (
              <li key={example} className="flex items-start gap-2">
                <span className="inline-flex h-[1lh] shrink-0 items-center leading-6">
                  <SpeakButton text={example} size="xs" />
                </span>
                <p className="leading-6 text-orange-950">{example}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-orange-900/40">Sin datos</p>
        )}
      </div>
      <ReadOnlyField label="Categoría gramatical" value={draft.partOfSpeech} />
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
