import {
  RUSSIAN_MAX_CHARS,
  updateWordCollectionSchema,
  type AuthUser,
  type SuggestionItem,
  type UpdateWordCollectionInput,
} from '@aprender-palabras/contracts'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { ClearableSearchField } from '@/components/clearable-search-field'
import { Button } from '@/components/ui/button'
import { WordRow } from '@/components/word-row'
import { ApiError } from '@/shared/api/auth'
import {
  addCollectionForUser,
  addWordToCollection,
  createCollectionTrainer,
  deleteCollection,
  getCollection,
  removeCollectionForUser,
  removeWordFromCollection,
  setCollectionStatus,
  updateCollection,
} from '@/shared/api/collections'
import { withReturnTo } from '@/shared/return-to'
import { SuggestionsErrorMessage } from '@/shared/suggestions-error'
import {
  DB_ONLY_QUOTA_HINT,
  MIN_QUERY_LENGTH,
  useWordSuggestions,
} from '@/shared/use-word-suggestions'
import { ProgressRing } from '../lessons/progress-ring'
import {
  COLLECTIONS_QUERY_KEY,
  collectionQueryKey,
} from './query-keys'

const SEARCH_DEBOUNCE_MS = 300

export function CollectionDetailPage({
  userMenu,
}: {
  userMenu: React.ReactNode
}) {
  const { collectionId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authUser = queryClient.getQueryData<AuthUser>(['auth', 'me'])
  const isAdmin = authUser?.role === 'admin'
  const [renameOpen, setRenameOpen] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const collectionQuery = useQuery({
    queryKey: collectionQueryKey(collectionId),
    queryFn: ({ signal }) => getCollection(collectionId, signal),
    enabled: Boolean(collectionId),
  })

  const liveQuery = query.trim()
  const wordSuggestions = useWordSuggestions(debouncedQuery, {
    enabled: Boolean(isAdmin && collectionId),
    canUseAiSuggestions: authUser?.canUseAiSuggestions !== false,
    queryKeyPrefix: ['suggestions', 'collection', collectionId],
    liveQuery,
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
    await queryClient.invalidateQueries({
      queryKey: collectionQueryKey(collectionId),
    })
  }

  const renameMutation = useMutation({
    mutationFn: (input: UpdateWordCollectionInput) =>
      updateCollection(collectionId, input),
    onSuccess: async () => {
      await invalidate()
      setRenameOpen(false)
    },
  })

  const addMutation = useMutation({
    mutationFn: () => addCollectionForUser(collectionId),
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: () => removeCollectionForUser(collectionId),
    onSuccess: async () => {
      await invalidate()
      setRemoveConfirm(false)
      navigate('/colecciones')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCollection(collectionId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: collectionQueryKey(collectionId) })
      navigate('/colecciones')
      void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: 'ready' | 'inactive') =>
      setCollectionStatus(collectionId, { status }),
    onSuccess: async () => {
      await invalidate()
      setDeactivateConfirm(false)
    },
  })

  const trainMutation = useMutation({
    mutationFn: () => createCollectionTrainer(collectionId),
    onSuccess: (result) => {
      navigate(`/entrenamiento/${result.trainerId}`)
    },
  })

  const addWordMutation = useMutation({
    mutationFn: (wordId: string) => addWordToCollection(collectionId, wordId),
    onSuccess: async () => {
      setQuery('')
      setDebouncedQuery('')
      await invalidate()
    },
  })

  const removeWordMutation = useMutation({
    mutationFn: (wordId: string) =>
      removeWordFromCollection(collectionId, wordId),
    onSuccess: invalidate,
  })

  const renameForm = useForm<UpdateWordCollectionInput>({
    resolver: zodResolver(updateWordCollectionSchema),
    values: { title: collectionQuery.data?.title ?? '' },
  })

  const collection = collectionQuery.data
  const statusText =
    collection?.status === 'created'
      ? 'Creada'
      : collection?.status === 'inactive'
        ? 'Inactiva'
        : 'Lista'
  const canPublish =
    Boolean(collection) &&
    collection!.status !== 'ready' &&
    collection!.wordCount > 0
  const canDeactivate = Boolean(collection) && collection!.status === 'ready'
  const isLastReadyWord =
    collection?.status === 'ready' && collection.wordCount <= 1
  const showSuggestions =
    isAdmin &&
    liveQuery.length >= MIN_QUERY_LENGTH &&
    (Boolean(wordSuggestions.validationError) ||
      wordSuggestions.isInitialLoading ||
      wordSuggestions.isSearchingAi ||
      Boolean(wordSuggestions.dbError) ||
      wordSuggestions.suggestions.length > 0 ||
      (wordSuggestions.isInputSynced &&
        !wordSuggestions.isInitialLoading &&
        !wordSuggestions.dbError))

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              {collection?.title ?? 'Colección'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/colecciones')}>
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
        {collectionQuery.isPending ? (
          <p className="text-sm text-orange-900/60">Cargando…</p>
        ) : null}
        {collectionQuery.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-red-700">No se pudo cargar la colección.</p>
            <Button variant="outline" onClick={() => collectionQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {collection ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              {collection.added && collection.progress !== null ? (
                <ProgressRing value={collection.progress} />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-orange-900/60">
                  {collection.wordCount === 1
                    ? '1 palabra'
                    : `${collection.wordCount} palabras`}
                  {isAdmin ? ` · ${statusText}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {collection.status === 'ready' && collection.added ? (
                    <>
                      <Button
                        disabled={!collection.canTrain || trainMutation.isPending}
                        onClick={() => trainMutation.mutate()}
                      >
                        Entrenar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setRemoveConfirm(true)}
                      >
                        Quitar
                      </Button>
                    </>
                  ) : null}
                  {collection.status === 'ready' && !collection.added ? (
                    <Button
                      disabled={addMutation.isPending}
                      onClick={() => addMutation.mutate()}
                    >
                      Añadir a mis colecciones
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <>
                      {canPublish ? (
                        <Button
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate('ready')}
                        >
                          Publicar
                        </Button>
                      ) : null}
                      {canDeactivate ? (
                        <Button
                          variant="outline"
                          disabled={statusMutation.isPending}
                          onClick={() => setDeactivateConfirm(true)}
                        >
                          Desactivar
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => setRenameOpen(true)}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Renombrar
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-700"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Eliminar
                      </Button>
                    </>
                  ) : null}
                </div>
                {statusMutation.isError ? (
                  <p className="mt-2 text-sm text-red-700">
                    No se pudo cambiar el estado. Añade al menos una palabra
                    para publicar.
                  </p>
                ) : null}
                {trainMutation.isError ? (
                  <p className="mt-2 text-sm text-red-700">
                    No hay palabras listas para entrenar.
                  </p>
                ) : null}
              </div>
            </div>

            {isAdmin ? (
              <div className="relative max-w-xl">
                <label className="sr-only" htmlFor="collection-search">
                  Añadir palabra
                </label>
                <ClearableSearchField
                  id="collection-search"
                  value={query}
                  onChange={setQuery}
                  placeholder="Buscar palabra para la colección…"
                  autoComplete="off"
                  maxLength={RUSSIAN_MAX_CHARS}
                />

                {showSuggestions ? (
                  <div
                    className="absolute top-full right-0 left-0 z-10 mt-2 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm"
                    role="listbox"
                    aria-label="Sugerencias"
                  >
                    {wordSuggestions.validationError ? (
                      <SuggestionsErrorMessage
                        message={wordSuggestions.validationError}
                      />
                    ) : null}

                    {!wordSuggestions.validationError &&
                    wordSuggestions.isInitialLoading ? (
                      <p
                        className="px-4 py-3 text-sm text-orange-900/70"
                        role="status"
                      >
                        Buscando…
                      </p>
                    ) : null}

                    {!wordSuggestions.validationError &&
                    wordSuggestions.dbError ? (
                      <SuggestionsErrorMessage
                        error={wordSuggestions.dbError}
                      />
                    ) : null}

                    {!wordSuggestions.validationError &&
                    !wordSuggestions.isInitialLoading &&
                    !wordSuggestions.dbError &&
                    wordSuggestions.suggestions.length === 0 &&
                    !wordSuggestions.isSearchingAi ? (
                      <p className="px-4 py-3 text-sm text-orange-900/70">
                        No hay sugerencias.
                      </p>
                    ) : null}

                    {!wordSuggestions.validationError &&
                    wordSuggestions.suggestions.length > 0 ? (
                      <ul>
                        {wordSuggestions.suggestions.map((item) => {
                          const alreadyInCollection =
                            item.wordId !== null &&
                            collection.words.some(
                              (word) => word.wordId === item.wordId,
                            )

                          return (
                            <CollectionSuggestionRow
                              key={`${item.spanish}|${item.russian}`}
                              item={item}
                              collectionId={collectionId}
                              alreadyInCollection={alreadyInCollection}
                              isAdding={addWordMutation.isPending}
                              onAddExisting={(wordId) =>
                                addWordMutation.mutate(wordId)
                              }
                            />
                          )
                        })}
                      </ul>
                    ) : null}

                    {!wordSuggestions.validationError &&
                    wordSuggestions.isSearchingAi ? (
                      <p
                        className="border-t border-orange-50 px-4 py-2 text-sm text-orange-900/60"
                        role="status"
                      >
                        Buscando con IA…
                      </p>
                    ) : null}

                    {wordSuggestions.showDbOnlyQuotaHint ? (
                      <p
                        className="border-t border-orange-50 px-4 py-2 text-sm text-orange-900/60"
                        role="status"
                      >
                        {DB_ONLY_QUOTA_HINT}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {isAdmin && addWordMutation.isError ? (
              <p className="text-sm text-red-700" role="alert">
                {isConflict(addWordMutation.error)
                  ? 'La palabra ya está en la colección.'
                  : 'No se pudo añadir la palabra.'}
              </p>
            ) : null}

            {collection.words.length === 0 ? (
              <p className="mt-8 text-sm text-orange-900/70">
                {isAdmin
                  ? 'Aún no hay palabras. Busca arriba para añadirlas.'
                  : 'Esta colección aún no tiene palabras.'}
              </p>
            ) : (
              <ul className="mt-8">
                {collection.words.map((word) => (
                  <WordRow
                    key={word.wordId}
                    spanish={word.spanish}
                    russian={word.russian}
                    progress={word.progress ?? 0}
                    onSelect={
                      isAdmin
                        ? () => {
                            void navigate(
                              withReturnTo(
                                `/admin/words/${word.wordId}/edit`,
                                `/colecciones/${collection.id}`,
                              ),
                            )
                          }
                        : word.userCardId
                          ? () => {
                              void navigate(
                                withReturnTo(
                                  `/words/${word.userCardId}`,
                                  `/colecciones/${collection.id}`,
                                ),
                              )
                            }
                          : undefined
                    }
                    trailing={
                      isAdmin ||
                      (collection.added && !word.readyForTrainer) ? (
                        <span className="inline-flex items-center gap-3">
                          {collection.added && !word.readyForTrainer ? (
                            <span className="text-xs text-amber-700">
                              Faltan datos para el entrenamiento
                            </span>
                          ) : null}
                          {isAdmin ? (
                            <button
                              type="button"
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Quitar ${word.spanish}`}
                              disabled={
                                removeWordMutation.isPending ||
                                isLastReadyWord
                              }
                              title={
                                isLastReadyWord
                                  ? 'No se puede quitar la última palabra de una colección lista'
                                  : undefined
                              }
                              onClick={() =>
                                removeWordMutation.mutate(word.wordId)
                              }
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </span>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>

      {renameOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <form
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={renameForm.handleSubmit((values) =>
              renameMutation.mutate(values),
            )}
          >
            <h2 className="text-lg font-semibold">Renombrar</h2>
            <input
              {...renameForm.register('title')}
              className="w-full rounded-xl border border-orange-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={renameMutation.isPending}>
                Guardar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {removeConfirm ? (
        <ConfirmDialog
          title="¿Quitar esta colección?"
          body="Se quitarán de tu diccionario solo las palabras traídas por esta colección que aún no hayas entrenado."
          confirmLabel="Quitar"
          pending={removeMutation.isPending}
          onCancel={() => setRemoveConfirm(false)}
          onConfirm={() => removeMutation.mutate()}
        />
      ) : null}

      {deleteConfirm ? (
        <ConfirmDialog
          title="¿Eliminar la colección?"
          body="La colección desaparecerá para todos. Las palabras en los diccionarios se conservan."
          confirmLabel="Eliminar"
          pending={deleteMutation.isPending}
          danger
          onCancel={() => setDeleteConfirm(false)}
          onConfirm={() => deleteMutation.mutate()}
        />
      ) : null}

      {deactivateConfirm ? (
        <ConfirmDialog
          title="¿Desactivar la colección?"
          body="Desaparecerá del catálogo y de Mis colecciones. Las palabras en los diccionarios se conservan."
          confirmLabel="Desactivar"
          pending={statusMutation.isPending}
          onCancel={() => setDeactivateConfirm(false)}
          onConfirm={() => statusMutation.mutate('inactive')}
        />
      ) : null}
    </main>
  )
}

function CollectionSuggestionRow({
  item,
  collectionId,
  alreadyInCollection,
  isAdding,
  onAddExisting,
}: {
  item: SuggestionItem
  collectionId: string
  alreadyInCollection: boolean
  isAdding: boolean
  onAddExisting: (wordId: string) => void
}) {
  const navigate = useNavigate()
  const label = `${item.spanish} — ${item.russian}`
  const params = new URLSearchParams({
    spanish: item.spanish,
    russian: item.russian,
    collectionId,
  })

  const text = (
    <span className="min-w-0 flex-1 text-base">
      <span className="font-medium">{item.spanish}</span>
      <span className="text-orange-900/50"> — </span>
      <span>{item.russian}</span>
    </span>
  )

  if (alreadyInCollection) {
    return (
      <li
        className="flex items-center gap-2 border-t border-orange-100 px-4 py-3 first:border-t-0"
        role="option"
      >
        {text}
        <span className="text-xs text-orange-900/50">En la colección</span>
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

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  pending: boolean
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-orange-900/70">{body}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button
            className={danger ? 'bg-red-700 hover:bg-red-800' : undefined}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
}
