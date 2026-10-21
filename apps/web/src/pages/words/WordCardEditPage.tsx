import {
  PART_OF_SPEECH_OPTIONS,
  partOfSpeechSchema,
  updateWordCardSchema,
  type PartOfSpeech,
  type RegeneratedWordImage,
  type UpdateWordCardInput,
  type UserCardDetail,
  type WordGender,
} from '@aprender-palabras/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SpeakButton } from '@/components/speak-button'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/shared/api/auth'
import {
  getWordCard,
  regenerateWordImage,
  updateWordCard,
} from '@/shared/api/words'

const DICTIONARY_QUERY_KEY = ['words', 'dictionary'] as const
const fieldClassName =
  'mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200'
const fieldErrorClassName = 'border-red-400 focus:border-red-500 focus:ring-red-200'

type EditFormState = {
  russian: string
  definitionEs: string
  examples: [string, string, string]
  partOfSpeech: PartOfSpeech | ''
  gender: WordGender | ''
  wrongRussianText: string
  wrongSpanishText: string
  imageUrl: string | null
  imagePhotographerName: string | null
  imagePhotographerUrl: string | null
  imagePageUrl: string | null
  imageProvider: 'unsplash' | null
  imageDownloadLocation: string | null
}

type FieldErrors = Partial<Record<keyof UpdateWordCardInput | 'form', string>>

export function WordCardEditPage() {
  const { cardId = '' } = useParams<{ cardId: string }>()
  const navigate = useNavigate()

  const cardQuery = useQuery({
    queryKey: ['words', 'card', cardId],
    queryFn: ({ signal }) => getWordCard(cardId, signal),
    enabled: cardId.length > 0,
    retry: false,
  })

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
              Aprender Palabras
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Editar palabra
            </h1>
          </div>
          <Button variant="outline" onClick={() => navigate(`/words/${cardId}`)}>
            Cancelar
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        {cardQuery.isPending ? (
          <p className="text-sm text-orange-900/70" role="status">
            Cargando la tarjeta…
          </p>
        ) : null}

        {cardQuery.isError ? (
          <div role="alert">
            <p className="text-sm text-red-700">
              {cardQuery.error instanceof ApiError &&
              cardQuery.error.status === 404
                ? 'No se encontró la tarjeta.'
                : 'No se pudo cargar la tarjeta.'}
            </p>
            <Button className="mt-4" onClick={() => void cardQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {cardQuery.isSuccess ? (
          <WordCardEditForm card={cardQuery.data} />
        ) : null}
      </div>
    </main>
  )
}

function WordCardEditForm({ card }: { card: UserCardDetail }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EditFormState>(() => toFormState(card))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [showErrors, setShowErrors] = useState(false)

  const parsed = useMemo(
    () => updateWordCardSchema.safeParse(toUpdatePayload(card.spanish, form)),
    [card.spanish, form],
  )

  const saveMutation = useMutation({
    mutationFn: (input: UpdateWordCardInput) => updateWordCard(card.id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['words', 'card', card.id], updated)
      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['lessons'] })
      await queryClient.invalidateQueries({ queryKey: ['training', 'today'] })
      navigate(`/words/${card.id}`, { replace: true })
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () =>
      regenerateWordImage({
        spanish: card.spanish,
        russian: form.russian.trim() || card.russian,
        excludeImageUrl: form.imageUrl ?? undefined,
      }),
    onSuccess: (image: RegeneratedWordImage) => {
      setForm((current) => ({
        ...current,
        imageUrl: image.imageUrl,
        imagePhotographerName: image.imagePhotographerName,
        imagePhotographerUrl: image.imagePhotographerUrl,
        imagePageUrl: image.imagePageUrl,
        imageProvider: image.imageProvider,
        imageDownloadLocation: image.imageDownloadLocation,
      }))
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setShowErrors(true)

    if (!parsed.success) {
      setErrors(zodIssuesToFieldErrors(parsed.error.issues))
      return
    }

    setErrors({})
    saveMutation.mutate(parsed.data)
  }

  const isSustantivo = form.partOfSpeech === 'sustantivo'
  const pending = saveMutation.isPending || regenerateMutation.isPending

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-[1lh] shrink-0 items-center text-3xl font-bold leading-tight">
          <SpeakButton text={card.spanish} size="lg" />
        </span>
        <p className="text-3xl font-bold tracking-tight leading-tight">
          {card.spanish}
        </p>
      </div>

      {form.imageUrl ? (
        <figure>
          <img
            src={form.imageUrl}
            alt=""
            className="max-h-80 w-full rounded-2xl object-cover"
          />
          {form.imagePhotographerName && form.imagePhotographerUrl ? (
            <figcaption className="mt-2 text-xs text-orange-900/60">
              Foto de{' '}
              <a
                href={form.imagePhotographerUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {form.imagePhotographerName}
              </a>
              {form.imagePageUrl ? (
                <>
                  {' '}
                  en{' '}
                  <a
                    href={form.imagePageUrl}
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
      ) : (
        <p className="text-sm text-orange-900/50">Sin imagen</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending || !form.russian.trim()}
          onClick={() => regenerateMutation.mutate()}
        >
          {regenerateMutation.isPending ? 'Buscando…' : 'Otra imagen'}
        </Button>
        {regenerateMutation.isError ? (
          <p className="text-sm text-red-700" role="alert">
            No se pudo generar otra imagen.
          </p>
        ) : null}
      </div>

      <Field
        label="Traducción"
        error={showErrors ? errors.russian : undefined}
      >
        <input
          className={`${fieldClassName} ${showErrors && errors.russian ? fieldErrorClassName : ''}`}
          value={form.russian}
          onChange={(event) =>
            setForm((current) => ({ ...current, russian: event.target.value }))
          }
        />
      </Field>

      <Field
        label="Definición"
        error={showErrors ? errors.definitionEs : undefined}
      >
        <textarea
          rows={3}
          className={`${fieldClassName} ${showErrors && errors.definitionEs ? fieldErrorClassName : ''}`}
          value={form.definitionEs}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              definitionEs: event.target.value,
            }))
          }
        />
      </Field>

      <div>
        <p className="text-sm font-medium text-orange-900/70">Ejemplos</p>
        <div className="mt-1 space-y-2">
          {form.examples.map((example, index) => (
            <input
              key={index}
              className={`${fieldClassName} ${showErrors && errors.examples ? fieldErrorClassName : ''}`}
              value={example}
              placeholder={index < 2 ? 'Obligatorio' : 'Opcional'}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => {
                  const next = [...current.examples] as [string, string, string]
                  next[index] = value
                  return { ...current, examples: next }
                })
              }}
            />
          ))}
        </div>
        {showErrors && errors.examples ? (
          <p className="mt-1 text-sm text-red-700">{errors.examples}</p>
        ) : null}
      </div>

      <Field
        label="Categoría gramatical"
        error={showErrors ? errors.partOfSpeech : undefined}
      >
        <select
          className={`${fieldClassName} ${showErrors && errors.partOfSpeech ? fieldErrorClassName : ''}`}
          value={form.partOfSpeech}
          onChange={(event) => {
            const value = event.target.value
            const parsedPos = partOfSpeechSchema.safeParse(value)
            setForm((current) => ({
              ...current,
              partOfSpeech: parsedPos.success ? parsedPos.data : '',
              gender:
                parsedPos.success && parsedPos.data === 'sustantivo'
                  ? current.gender
                  : '',
            }))
          }}
        >
          <option value="">Seleccionar…</option>
          {PART_OF_SPEECH_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      {isSustantivo ? (
        <Field
          label="Género"
          error={showErrors ? errors.gender : undefined}
        >
          <select
            className={`${fieldClassName} ${showErrors && errors.gender ? fieldErrorClassName : ''}`}
            value={form.gender}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                gender: event.target.value as WordGender | '',
              }))
            }
          >
            <option value="">Seleccionar…</option>
            <option value="masculine">masculino</option>
            <option value="feminine">femenino</option>
          </select>
        </Field>
      ) : null}

      <Field
        label="Opciones incorrectas (ruso)"
        hint="Una por línea, mínimo 3"
        error={showErrors ? errors.wrongRussian : undefined}
      >
        <textarea
          rows={5}
          className={`${fieldClassName} ${showErrors && errors.wrongRussian ? fieldErrorClassName : ''}`}
          value={form.wrongRussianText}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              wrongRussianText: event.target.value,
            }))
          }
        />
      </Field>

      <Field
        label="Opciones incorrectas (español)"
        hint="Una por línea, mínimo 3"
        error={showErrors ? errors.wrongSpanish : undefined}
      >
        <textarea
          rows={5}
          className={`${fieldClassName} ${showErrors && errors.wrongSpanish ? fieldErrorClassName : ''}`}
          value={form.wrongSpanishText}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              wrongSpanishText: event.target.value,
            }))
          }
        />
      </Field>

      {saveMutation.isError ? (
        <p className="text-sm text-red-700" role="alert">
          {saveMutation.error instanceof ApiError &&
          saveMutation.error.status === 409
            ? 'Ya existe otra palabra con esta traducción.'
            : 'No se pudo guardar. Revisa los campos e inténtalo de nuevo.'}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          className="bg-orange-700 hover:bg-orange-800"
          disabled={pending}
        >
          {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => navigate(`/words/${card.id}`)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-orange-900/70">{label}</span>
      {children}
      {hint && !error ? (
        <span className="mt-1 block text-xs text-orange-900/50">{hint}</span>
      ) : null}
      {error ? (
        <span className="mt-1 block text-sm text-red-700">{error}</span>
      ) : null}
    </label>
  )
}

function toFormState(card: UserCardDetail): EditFormState {
  const partOfSpeech = partOfSpeechSchema.safeParse(card.partOfSpeech)
  const examples = [...card.examples]
  while (examples.length < 3) {
    examples.push('')
  }

  return {
    russian: card.russian,
    definitionEs: card.definitionEs ?? '',
    examples: [examples[0] ?? '', examples[1] ?? '', examples[2] ?? ''],
    partOfSpeech: partOfSpeech.success ? partOfSpeech.data : '',
    gender: card.gender ?? '',
    wrongRussianText: card.wrongRussian.join('\n'),
    wrongSpanishText: card.wrongSpanish.join('\n'),
    imageUrl: card.imageUrl,
    imagePhotographerName: card.imagePhotographerName,
    imagePhotographerUrl: card.imagePhotographerUrl,
    imagePageUrl: card.imagePageUrl,
    imageProvider: card.imageProvider,
    imageDownloadLocation: null,
  }
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function toUpdatePayload(
  spanish: string,
  form: EditFormState,
): UpdateWordCardInput {
  return {
    spanish,
    russian: form.russian,
    definitionEs: form.definitionEs,
    examples: form.examples.map((item) => item.trim()).filter(Boolean),
    partOfSpeech: form.partOfSpeech as PartOfSpeech,
    gender:
      form.partOfSpeech === 'sustantivo'
        ? form.gender === ''
          ? null
          : form.gender
        : null,
    wrongRussian: linesToList(form.wrongRussianText),
    wrongSpanish: linesToList(form.wrongSpanishText),
    imageUrl: form.imageUrl,
    imagePhotographerName: form.imagePhotographerName,
    imagePhotographerUrl: form.imagePhotographerUrl,
    imagePageUrl: form.imagePageUrl,
    imageProvider: form.imageProvider,
    imageDownloadLocation: form.imageDownloadLocation,
  }
}

function zodIssuesToFieldErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form') as keyof FieldErrors
    if (!errors[key]) {
      errors[key] = humanizeError(key, issue.message)
    }
  }
  return errors
}

function humanizeError(field: string, message: string): string {
  if (field === 'russian') {
    return 'La traducción es obligatoria.'
  }
  if (field === 'definitionEs') {
    return 'La definición es obligatoria.'
  }
  if (field === 'examples') {
    return 'Añade al menos 2 ejemplos.'
  }
  if (field === 'partOfSpeech') {
    return 'Elige una categoría gramatical.'
  }
  if (field === 'gender') {
    return 'Elige el género.'
  }
  if (field === 'wrongRussian') {
    return message.includes('primary')
      ? 'No puede coincidir con la traducción.'
      : 'Añade al menos 3 opciones incorrectas en ruso.'
  }
  if (field === 'wrongSpanish') {
    return message.includes('Spanish')
      ? 'No puede coincidir con la palabra en español.'
      : 'Añade al menos 3 opciones incorrectas en español.'
  }
  return 'Campo inválido.'
}
