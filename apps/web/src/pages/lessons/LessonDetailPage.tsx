import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  RUSSIAN_MAX_CHARS,
  type LessonWordItem,
  type SuggestionItem,
} from '@aprender-palabras/contracts'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ProgressDot } from '@/components/progress-dot'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { WordRow } from '@/components/word-row'
import { ApiError } from '../../shared/api/auth'
import {
  addExistingWordToLesson,
  getLesson,
  getLessonTrainingReadiness,
  removeWordFromLesson,
  renameLesson,
} from '../../shared/api/lessons'
import { getSuggestions } from '../../shared/api/suggestions'
import { SuggestionsErrorMessage } from '../../shared/suggestions-error'
import { getSuggestionsQueryError } from '../../shared/suggestions-query'
import { ProgressRing } from './progress-ring'
import { LESSONS_QUERY_KEY } from './query-keys'
import { lessonStatusLabel } from './status-label'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const LESSON_QUERY_KEY = (id: string) => ['lessons', 'detail', id] as const

export function LessonDetailPage({
  userMenu,
}: {
  userMenu: React.ReactNode
}) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTitle, setRenameTitle] = useState('')
  const [removeTarget, setRemoveTarget] = useState<LessonWordItem | null>(null)
  const [dispositionNeeded, setDispositionNeeded] = useState(false)
  const [trainInfoOpen, setTrainInfoOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query])

  const lessonQuery = useQuery({
    queryKey: LESSON_QUERY_KEY(id),
    queryFn: ({ signal }) => getLesson(id, signal),
    enabled: Boolean(id),
  })

  const suggestionsValidationError = getSuggestionsQueryError(debouncedQuery)
  const suggestionsEnabled =
    debouncedQuery.length >= MIN_QUERY_LENGTH && !suggestionsValidationError
  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', 'lesson', id, debouncedQuery],
    queryFn: ({ signal }) => getSuggestions(debouncedQuery, signal),
    enabled: suggestionsEnabled && Boolean(id),
    retry: false,
  })

  const renameMutation = useMutation({
    mutationFn: (title: string) => renameLesson(id, { title }),
    onSuccess: async () => {
      setRenameOpen(false)
      await queryClient.invalidateQueries({ queryKey: LESSON_QUERY_KEY(id) })
      await queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
    },
  })

  const addMutation = useMutation({
    mutationFn: (wordId: string) => addExistingWordToLesson(id, wordId),
    onSuccess: async () => {
      setQuery('')
      setDebouncedQuery('')
      await queryClient.invalidateQueries({ queryKey: LESSON_QUERY_KEY(id) })
      await queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({
      wordId,
      disposition,
    }: {
      wordId: string
      disposition?: 'keep_dictionary' | 'delete_card'
    }) => removeWordFromLesson(id, wordId, { disposition }),
    onSuccess: async (result) => {
      if (result.requiresDisposition) {
        setDispositionNeeded(true)
        return
      }

      setRemoveTarget(null)
      setDispositionNeeded(false)
      await queryClient.invalidateQueries({ queryKey: LESSON_QUERY_KEY(id) })
      await queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['words', 'dictionary'] })
    },
  })

  const readinessQuery = useQuery({
    queryKey: ['lessons', 'readiness', id],
    queryFn: ({ signal }) => getLessonTrainingReadiness(id, signal),
    enabled: trainInfoOpen && Boolean(id),
  })

  if (lessonQuery.isPending) {
    return (
      <main className="grid min-h-svh place-items-center bg-orange-50 text-orange-950">
        <p role="status">Cargando la lección…</p>
      </main>
    )
  }

  if (lessonQuery.isError || !lessonQuery.data) {
    return (
      <main className="grid min-h-svh place-items-center bg-orange-50 p-8 text-center text-orange-950">
        <div role="alert">
          <p>No se pudo cargar la lección.</p>
          <Button className="mt-4" onClick={() => navigate('/lecciones')}>
            Volver a lecciones
          </Button>
        </div>
      </main>
    )
  }

  const lesson = lessonQuery.data
  const showSuggestions =
    debouncedQuery.length >= MIN_QUERY_LENGTH &&
    (Boolean(suggestionsValidationError) ||
      suggestionsQuery.isFetching ||
      suggestionsQuery.isError ||
      suggestionsQuery.isSuccess)

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <BrandLink />
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight">
                {lesson.position}. {lesson.title}
              </h1>
              <button
                type="button"
                aria-label="Renombrar"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-orange-700 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
                onClick={() => {
                  setRenameTitle(lesson.title)
                  setRenameOpen(true)
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-orange-900/60">
              {lessonStatusLabel(lesson.status)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/lecciones')}>
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProgressRing value={lesson.averageProgress} />
            <div>
              <p className="text-sm text-orange-900/60">
                {lesson.wordCount === 1
                  ? '1 palabra'
                  : `${lesson.wordCount} palabras`}
              </p>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTrainInfoOpen(true)}
                >
                  Entrenar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-8 max-w-xl">
          <label className="sr-only" htmlFor="lesson-search">
            Añadir palabra
          </label>
          <input
            id="lesson-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar palabra para la lección…"
            autoComplete="off"
            maxLength={RUSSIAN_MAX_CHARS}
            className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
          />

          {showSuggestions ? (
            <div
              className="absolute top-full right-0 left-0 z-10 mt-2 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm"
              role="listbox"
              aria-label="Sugerencias"
            >
              {suggestionsValidationError ? (
                <SuggestionsErrorMessage message={suggestionsValidationError} />
              ) : null}

              {!suggestionsValidationError && suggestionsQuery.isFetching ? (
                <p className="px-4 py-3 text-sm text-orange-900/70" role="status">
                  Buscando…
                </p>
              ) : null}

              {!suggestionsValidationError && suggestionsQuery.isError ? (
                <SuggestionsErrorMessage error={suggestionsQuery.error} />
              ) : null}

              {!suggestionsValidationError &&
              suggestionsQuery.isSuccess &&
              suggestionsQuery.data.suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-orange-900/70">
                  No hay sugerencias.
                </p>
              ) : null}

              {!suggestionsValidationError &&
              suggestionsQuery.isSuccess &&
              suggestionsQuery.data.suggestions.length > 0 ? (
                <ul>
                  {suggestionsQuery.data.suggestions.map((item) => {
                    const lessonWord =
                      item.wordId === null
                        ? undefined
                        : lesson.words.find(
                            (word) => word.wordId === item.wordId,
                          )

                    return (
                      <LessonSuggestionRow
                        key={`${item.spanish}|${item.russian}`}
                        item={item}
                        lessonId={id}
                        lessonProgress={lessonWord?.progress ?? null}
                        isAdding={addMutation.isPending}
                        onAddExisting={(wordId) => addMutation.mutate(wordId)}
                      />
                    )
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {addMutation.isError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {isConflict(addMutation.error)
              ? 'La palabra ya está en la lección.'
              : 'No se pudo añadir la palabra.'}
          </p>
        ) : null}

        {lesson.words.length === 0 ? (
          <p className="mt-8 text-sm text-orange-900/70">
            Aún no hay palabras. Busca arriba para añadirlas.
          </p>
        ) : (
          <ul className="mt-8">
            {lesson.words.map((item) => (
              <WordRow
                key={item.wordId}
                spanish={item.spanish}
                russian={item.russian}
                progress={item.progress}
                onSelect={
                  item.userCardId
                    ? () => {
                        void navigate(`/words/${item.userCardId}`)
                      }
                    : undefined
                }
                trailing={
                  <button
                    type="button"
                    className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                    aria-label={`Quitar ${item.spanish}`}
                    onClick={() => {
                      setDispositionNeeded(false)
                      setRemoveTarget(item)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {renameOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Renombrar lección"
        >
          <form
            className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg"
            onSubmit={(event) => {
              event.preventDefault()
              renameMutation.mutate(renameTitle.trim())
            }}
          >
            <h2 className="text-xl font-bold">Renombrar</h2>
            <input
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              className="mt-4 h-10 w-full rounded-lg border border-orange-200 px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-orange-700 hover:bg-orange-800"
                disabled={
                  renameMutation.isPending || renameTitle.trim().length === 0
                }
              >
                {renameMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {removeTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quitar palabra"
        >
          <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-bold">Quitar de la lección</h2>
            {!dispositionNeeded ? (
              <>
                <p className="mt-3 text-sm text-orange-900/80">
                  ¿Quitar «{removeTarget.spanish}» de esta lección?
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRemoveTarget(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="bg-orange-700 hover:bg-orange-800"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate({ wordId: removeTarget.wordId })
                    }
                  >
                    Quitar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-orange-900/80">
                  Esta palabra preparada no está en el diccionario ni en otras
                  lecciones. ¿Qué hacer?
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate({
                        wordId: removeTarget.wordId,
                        disposition: 'keep_dictionary',
                      })
                    }
                  >
                    Pasar al diccionario
                  </Button>
                  <Button
                    className="bg-red-700 hover:bg-red-800"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate({
                        wordId: removeTarget.wordId,
                        disposition: 'delete_card',
                      })
                    }
                  >
                    Eliminar tarjeta
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {trainInfoOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Entrenar"
        >
          <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-bold">Entrenar</h2>
            {readinessQuery.isPending ? (
              <p className="mt-3 text-sm text-orange-900/70">Comprobando…</p>
            ) : null}
            {readinessQuery.isSuccess ? (
              <>
                <p className="mt-3 text-sm text-orange-900/80">
                  {readinessQuery.data.readyCount} palabras listas.
                </p>
                {!readinessQuery.data.canStart ? (
                  <div className="mt-3">
                    <p className="text-sm text-red-700">
                      Se necesitan al menos 4 palabras listas.
                    </p>
                    {readinessQuery.data.missingByWord.length > 0 ? (
                      <ul className="mt-2 max-h-40 overflow-auto text-sm text-orange-900/70">
                        {readinessQuery.data.missingByWord.map((item) => (
                          <li key={item.wordId}>
                            {item.spanish}: faltan {item.missingFields.join(', ')}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-orange-900/80">
                    El entrenador de lecciones estará disponible en la próxima
                    etapa.
                  </p>
                )}
              </>
            ) : null}
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setTrainInfoOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function LessonSuggestionRow({
  item,
  lessonId,
  lessonProgress,
  isAdding,
  onAddExisting,
}: {
  item: SuggestionItem
  lessonId: string
  lessonProgress: number | null
  isAdding: boolean
  onAddExisting: (wordId: string) => void
}) {
  const navigate = useNavigate()
  const label = `${item.spanish} — ${item.russian}`
  const params = new URLSearchParams({
    spanish: item.spanish,
    russian: item.russian,
    lessonId,
  })
  const alreadyInLesson = lessonProgress !== null

  const text = (
    <span className="min-w-0 flex-1 text-base">
      <span className="font-medium">{item.spanish}</span>
      <span className="text-orange-900/50"> — </span>
      <span>{item.russian}</span>
    </span>
  )

  if (alreadyInLesson) {
    return (
      <li
        className="flex items-center gap-2 border-t border-orange-100 px-4 py-3 first:border-t-0"
        role="option"
      >
        {text}
        <LessonSuggestionProgressIcon
          progress={lessonProgress}
          wordLabel={label}
        />
      </li>
    )
  }

  if (item.wordId) {
    return (
      <li className="border-t border-orange-100 first:border-t-0" role="option">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Añadir ${label}`}
          disabled={isAdding}
          onClick={() => onAddExisting(item.wordId!)}
        >
          {text}
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-600 text-white"
            aria-hidden
          >
            <Plus className="size-4 stroke-[3]" />
          </span>
        </button>
      </li>
    )
  }

  return (
    <li className="border-t border-orange-100 first:border-t-0" role="option">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-orange-50"
        onClick={() => navigate(`/words/new?${params}`)}
      >
        {text}
      </button>
    </li>
  )
}

function LessonSuggestionProgressIcon({
  progress,
  wordLabel,
}: {
  progress: number
  wordLabel: string
}) {
  const mastered = progress >= 100

  return (
    <span
      className="shrink-0"
      aria-label={
        mastered
          ? `${wordLabel}, dominada`
          : `${wordLabel}, progreso ${progress}%`
      }
    >
      <ProgressDot progress={progress} />
    </span>
  )
}

function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
}
