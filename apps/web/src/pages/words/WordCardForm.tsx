import {
  PART_OF_SPEECH_OPTIONS,
  partOfSpeechSchema,
  RUSSIAN_MAX_CHARS,
  SPANISH_MAX_CHARS,
  updateWordCardSchema,
  type PartOfSpeech,
  type RegeneratedWordImage,
  type UnsplashImage,
  type UpdateWordCardInput,
  type WordGender,
} from '@aprender-palabras/contracts'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { UnsplashAttribution } from '@/components/unsplash-attribution'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/shared/api/auth'
import {
  fetchImageSearchQuery,
  regenerateWordImage,
} from '@/shared/api/words'

const fieldClassName =
  'mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200'
const fieldErrorClassName =
  'border-red-400 focus:border-red-500 focus:ring-red-200'

export type WordCardFormInitial = {
  spanish: string
  russian: string
  definitionEs: string | null
  examples: string[]
  partOfSpeech: string | null
  gender: WordGender | null
  wrongRussian: string[]
  wrongSpanish: string[]
  imageUrl: string | null
  imagePhotographerName: string | null
  imagePhotographerUrl: string | null
  imagePageUrl: string | null
  imageProvider: 'unsplash' | null
  imageDownloadLocation?: string | null
  imageCandidates?: UnsplashImage[]
  unsplashQuery?: string | null
}

type FormState = {
  spanish: string
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
  imageCandidates: UnsplashImage[]
  unsplashQuery: string | null
}

type FieldErrors = Partial<Record<keyof UpdateWordCardInput | 'form', string>>

export function WordCardForm({
  initial,
  spanishEditable,
  submitLabel,
  submittingLabel,
  isSubmitting,
  saveError,
  conflictMessage = 'Ya existe otra palabra con esta traducción.',
  onSubmit,
  onCancel,
}: {
  initial: WordCardFormInitial
  spanishEditable: boolean
  submitLabel: string
  submittingLabel: string
  isSubmitting: boolean
  saveError: unknown
  conflictMessage?: string
  onSubmit: (payload: UpdateWordCardInput) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [showErrors, setShowErrors] = useState(false)
  const [searchPromptOpen, setSearchPromptOpen] = useState(false)
  const [searchPrompt, setSearchPrompt] = useState('')

  const parsed = useMemo(
    () => updateWordCardSchema.safeParse(toUpdatePayload(form)),
    [form],
  )

  const suggestQueryMutation = useMutation({
    mutationFn: () =>
      fetchImageSearchQuery({
        spanish: form.spanish.trim() || initial.spanish,
        russian: form.russian.trim() || initial.russian,
      }),
    onSuccess: (result) => {
      setSearchPrompt(result.unsplashQuery)
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: (unsplashQuery: string) =>
      regenerateWordImage({
        spanish: form.spanish.trim() || initial.spanish,
        russian: form.russian.trim() || initial.russian,
        excludeImageUrl: form.imageUrl ?? undefined,
        unsplashQuery,
      }),
    onSuccess: (image: RegeneratedWordImage) => {
      setForm((current) => ({
        ...current,
        ...selectedImageFields(image),
        imageCandidates: image.imageCandidates,
        unsplashQuery: image.unsplashQuery,
      }))
      setSearchPromptOpen(false)
    },
  })

  function openSearchPrompt() {
    const existing = form.unsplashQuery?.trim() ?? ''
    setSearchPrompt(existing)
    suggestQueryMutation.reset()
    regenerateMutation.reset()
    setSearchPromptOpen(true)
    if (!existing) {
      suggestQueryMutation.mutate()
    }
  }

  function handleSearchPrompt() {
    const query = searchPrompt.replace(/\s+/g, ' ').trim()
    if (!query) {
      return
    }
    regenerateMutation.mutate(query)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setShowErrors(true)

    if (!parsed.success) {
      setErrors(zodIssuesToFieldErrors(parsed.error.issues))
      return
    }

    setErrors({})
    onSubmit(parsed.data)
  }

  const isSustantivo = form.partOfSpeech === 'sustantivo'
  const pending = isSubmitting || regenerateMutation.isPending
  const promptLoading =
    searchPromptOpen && !form.unsplashQuery && suggestQueryMutation.isPending
  const promptReady = searchPrompt.trim().length > 0 && !promptLoading

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {spanishEditable ? (
        <Field
          label="Español"
          error={showErrors ? errors.spanish : undefined}
        >
          <input
            className={`${fieldClassName} text-3xl font-bold tracking-tight ${showErrors && errors.spanish ? fieldErrorClassName : ''}`}
            value={form.spanish}
            maxLength={SPANISH_MAX_CHARS}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                spanish: event.target.value,
              }))
            }
          />
        </Field>
      ) : (
        <p className="text-3xl font-bold tracking-tight leading-tight">
          {form.spanish}
        </p>
      )}

      {form.imageUrl ? (
        <figure>
          <img
            src={form.imageUrl}
            alt=""
            className="max-h-80 w-full rounded-2xl object-cover"
          />
          {form.imagePhotographerName && form.imagePhotographerUrl ? (
            <UnsplashAttribution
              photographerName={form.imagePhotographerName}
              photographerUrl={form.imagePhotographerUrl}
              variant="caption"
            />
          ) : null}
        </figure>
      ) : (
        <p className="text-sm text-orange-900/50">Sin imagen</p>
      )}

      {form.imageCandidates.length > 0 ? (
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="listbox"
          aria-label="Imágenes sugeridas"
        >
          {form.imageCandidates.map((candidate) => {
            const selected = candidate.imageUrl === form.imageUrl
            return (
              <button
                key={candidate.imageUrl}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={pending}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 ${
                  selected
                    ? 'ring-3 ring-orange-600'
                    : 'ring-1 ring-orange-200 hover:ring-orange-400'
                }`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    ...selectedImageFields(candidate),
                  }))
                }
              >
                <img
                  src={candidate.imageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending || !form.russian.trim() || !form.spanish.trim()}
          onClick={openSearchPrompt}
        >
          Otra imagen
        </Button>
      </div>

      {searchPromptOpen ? (
        <ImageSearchPromptModal
          value={searchPrompt}
          loadingQuery={promptLoading}
          queryError={suggestQueryMutation.isError}
          searching={regenerateMutation.isPending}
          searchError={regenerateMutation.isError}
          canSubmit={promptReady}
          onChange={setSearchPrompt}
          onClose={() => setSearchPromptOpen(false)}
          onSearch={handleSearchPrompt}
        />
      ) : null}

      <Field
        label="Traducción"
        error={showErrors ? errors.russian : undefined}
      >
        <input
          className={`${fieldClassName} ${showErrors && errors.russian ? fieldErrorClassName : ''}`}
          value={form.russian}
          maxLength={RUSSIAN_MAX_CHARS}
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
        <Field label="Género" error={showErrors ? errors.gender : undefined}>
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

      {saveError ? (
        <p className="text-sm text-red-700" role="alert">
          {saveError instanceof ApiError && saveError.status === 409
            ? conflictMessage
            : 'No se pudo guardar. Revisa los campos e inténtalo de nuevo.'}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          className="bg-orange-700 hover:bg-orange-800"
          disabled={pending}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
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
  className,
  children,
}: {
  label: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={className ? `block ${className}` : 'block'}>
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

export function toFormState(initial: WordCardFormInitial): FormState {
  const partOfSpeech = partOfSpeechSchema.safeParse(initial.partOfSpeech)
  const examples = [...initial.examples]
  while (examples.length < 3) {
    examples.push('')
  }

  return {
    spanish: initial.spanish,
    russian: initial.russian,
    definitionEs: initial.definitionEs ?? '',
    examples: [examples[0] ?? '', examples[1] ?? '', examples[2] ?? ''],
    partOfSpeech: partOfSpeech.success ? partOfSpeech.data : '',
    gender: initial.gender ?? '',
    wrongRussianText: initial.wrongRussian.join('\n'),
    wrongSpanishText: initial.wrongSpanish.join('\n'),
    imageUrl: initial.imageUrl,
    imagePhotographerName: initial.imagePhotographerName,
    imagePhotographerUrl: initial.imagePhotographerUrl,
    imagePageUrl: initial.imagePageUrl,
    imageProvider: initial.imageProvider,
    imageDownloadLocation: initial.imageDownloadLocation ?? null,
    imageCandidates: initial.imageCandidates ?? [],
    unsplashQuery: initial.unsplashQuery ?? null,
  }
}

function selectedImageFields(image: UnsplashImage) {
  return {
    imageUrl: image.imageUrl,
    imagePhotographerName: image.imagePhotographerName,
    imagePhotographerUrl: image.imagePhotographerUrl,
    imagePageUrl: image.imagePageUrl,
    imageProvider: image.imageProvider,
    imageDownloadLocation: image.imageDownloadLocation,
  }
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function toUpdatePayload(form: FormState): UpdateWordCardInput {
  return {
    spanish: form.spanish,
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
  if (field === 'spanish') {
    if (message.includes('words')) {
      return 'Máximo 10 palabras en español.'
    }
    if (
      message.includes('Too big') ||
      message.includes('at most') ||
      message.includes('<=')
    ) {
      return 'Máximo 100 caracteres en español.'
    }
    return 'La palabra en español es obligatoria.'
  }
  if (field === 'russian') {
    if (
      message.includes('Too big') ||
      message.includes('at most') ||
      message.includes('<=')
    ) {
      return 'Máximo 120 caracteres en ruso.'
    }
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

export function updatePayloadToWordDraft(
  payload: UpdateWordCardInput,
): import('@aprender-palabras/contracts').WordDraft {
  return {
    ...payload,
    additionalTranslations: [],
    imageCandidates: [],
    unsplashQuery: null,
  }
}

function ImageSearchPromptModal({
  value,
  loadingQuery,
  queryError,
  searching,
  searchError,
  canSubmit,
  onChange,
  onClose,
  onSearch,
}: {
  value: string
  loadingQuery: boolean
  queryError: boolean
  searching: boolean
  searchError: boolean
  canSubmit: boolean
  onChange: (value: string) => void
  onClose: () => void
  onSearch: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar otra imagen"
    >
      <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
        <h2 className="text-xl font-bold tracking-tight">Otra imagen</h2>
        <p className="mt-2 text-sm text-orange-900/70">
          Edita la frase de búsqueda en inglés para Unsplash.
        </p>
        <label
          className="mt-5 mb-1.5 block text-sm font-medium"
          htmlFor="unsplash-search-prompt"
        >
          Búsqueda
        </label>
        <input
          id="unsplash-search-prompt"
          autoFocus
          disabled={loadingQuery || searching}
          className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200 disabled:opacity-60"
          value={value}
          placeholder={loadingQuery ? 'Generando…' : 'parade crowd'}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return
            }
            event.preventDefault()
            if (canSubmit && !searching) {
              onSearch()
            }
          }}
        />
        {queryError ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            No se pudo sugerir una frase. Escríbela manualmente.
          </p>
        ) : null}
        {searchError ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            No se pudo buscar otra imagen.
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={searching}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-orange-700 hover:bg-orange-800"
            disabled={!canSubmit || searching}
            onClick={onSearch}
          >
            {searching ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
