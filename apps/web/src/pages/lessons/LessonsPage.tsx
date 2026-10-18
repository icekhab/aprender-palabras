import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createLessonSchema,
  type CreateLessonInput,
  type LessonListItem,
  type SetCurrentLessonPreview,
} from '@aprender-palabras/contracts'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  createLesson,
  deleteLesson,
  listLessons,
  moveLesson,
  previewSetCurrentLesson,
  setCurrentLesson,
} from '../../shared/api/lessons'
import { ProgressRing } from './progress-ring'
import { LESSONS_QUERY_KEY } from './query-keys'
import { lessonStatusLabel } from './status-label'

const LESSON_PAGE_SIZE = 20

export function LessonsPage({
  userMenu,
}: {
  userMenu: React.ReactNode
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LessonListItem | null>(null)
  const [currentPreview, setCurrentPreview] =
    useState<SetCurrentLessonPreview | null>(null)

  const lessonsQuery = useInfiniteQuery({
    queryKey: LESSONS_QUERY_KEY,
    queryFn: ({ pageParam, signal }) =>
      listLessons(
        { limit: LESSON_PAGE_SIZE, offset: pageParam },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.hasMore) {
        return undefined
      }

      return pages.reduce((sum, page) => sum + page.items.length, 0)
    },
  })

  const items = lessonsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const totalCount = lessonsQuery.data?.pages[0]?.totalCount ?? 0

  const createMutation = useMutation({
    mutationFn: createLesson,
    onSuccess: async (lesson) => {
      await queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
      setCreateOpen(false)
      navigate(`/lecciones/${lesson.id}`)
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({
      lessonId,
      direction,
    }: {
      lessonId: string
      direction: 'up' | 'down'
    }) => moveLesson(lessonId, { direction }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (lessonId: string) => deleteLesson(lessonId),
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
    },
  })

  const previewMutation = useMutation({
    mutationFn: (lessonId: string) =>
      previewSetCurrentLesson({ lessonId }),
    onSuccess: (preview) => {
      setCurrentPreview(preview)
    },
  })

  const setCurrentMutation = useMutation({
    mutationFn: (lessonId: string) => setCurrentLesson({ lessonId }),
    onSuccess: async () => {
      setCurrentPreview(null)
      await queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['words', 'dictionary'] })
    },
  })

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
              Aprender Palabras
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Lecciones</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BookOpen className="size-6 text-orange-700" aria-hidden />
            <p className="text-sm text-orange-900/60">
              {lessonsQuery.isSuccess
                ? lessonsQuery.data.pages[0]?.totalCount === 1
                  ? '1 lección'
                  : `${lessonsQuery.data.pages[0]?.totalCount ?? 0} lecciones`
                : 'Tus lecciones'}
            </p>
          </div>
          <Button
            className="bg-orange-700 hover:bg-orange-800"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Nueva lección
          </Button>
        </div>

        {lessonsQuery.isPending && (
          <p className="mt-8 text-sm text-orange-900/70" role="status">
            Cargando las lecciones…
          </p>
        )}

        {lessonsQuery.isError && (
          <div className="mt-8" role="alert">
            <p className="text-sm text-red-700">
              No se pudieron cargar las lecciones.
            </p>
            <Button
              className="mt-4"
              onClick={() => void lessonsQuery.refetch()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {lessonsQuery.isSuccess && items.length === 0 && (
          <p className="mt-8 text-sm text-orange-900/70">
            Aún no hay lecciones. Crea la primera.
          </p>
        )}

        {items.length > 0 && (
          <>
            <ul className="mt-8 divide-y divide-orange-100">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    onClick={() => navigate(`/lecciones/${item.id}`)}
                  >
                    <ProgressRing value={item.averageProgress} />
                    <div className="min-w-0">
                      <p className="font-semibold text-orange-950">
                        {item.position}. {item.title}
                      </p>
                      <p className="mt-1 text-sm text-orange-900/60">
                        {lessonStatusLabel(item.status)} · {item.wordCount}{' '}
                        {item.wordCount === 1 ? 'palabra' : 'palabras'}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={moveMutation.isPending || item.position === 1}
                      aria-label="Subir"
                      onClick={() =>
                        moveMutation.mutate({
                          lessonId: item.id,
                          direction: 'up',
                        })
                      }
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        moveMutation.isPending || item.position >= totalCount
                      }
                      aria-label="Bajar"
                      onClick={() =>
                        moveMutation.mutate({
                          lessonId: item.id,
                          direction: 'down',
                        })
                      }
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    {item.status !== 'current' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={previewMutation.isPending}
                        onClick={() => previewMutation.mutate(item.id)}
                      >
                        Marcar actual
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-700"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {lessonsQuery.hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  disabled={lessonsQuery.isFetchingNextPage}
                  onClick={() => void lessonsQuery.fetchNextPage()}
                >
                  {lessonsQuery.isFetchingNextPage
                    ? 'Cargando…'
                    : 'Mostrar más'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {createOpen ? (
        <CreateLessonModal
          isPending={createMutation.isPending}
          error={createMutation.isError}
          onClose={() => setCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Eliminar lección"
          confirmLabel={
            deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'
          }
          confirmDisabled={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        >
          <p className="text-sm text-orange-900/80">
            ¿Eliminar «{deleteTarget.title}»? Las palabras del diccionario no
            se borran.
          </p>
          {deleteTarget.status === 'current' ? (
            <p className="mt-2 text-sm text-orange-900/80">
              Esta es la lección actual. Se elegirá la anterior si existe.
            </p>
          ) : null}
        </ConfirmModal>
      ) : null}

      {currentPreview ? (
        <ConfirmModal
          title="Marcar como actual"
          confirmLabel={
            setCurrentMutation.isPending ? 'Guardando…' : 'Confirmar'
          }
          confirmDisabled={setCurrentMutation.isPending}
          onCancel={() => setCurrentPreview(null)}
          onConfirm={() => setCurrentMutation.mutate(currentPreview.lessonId)}
        >
          <p className="text-sm text-orange-900/80">
            Nueva lección actual: <strong>{currentPreview.lessonTitle}</strong>
          </p>
          {currentPreview.nextLessonTitle ? (
            <p className="mt-2 text-sm text-orange-900/80">
              Siguiente: {currentPreview.nextLessonTitle}
            </p>
          ) : (
            <p className="mt-2 text-sm text-orange-900/80">
              No hay lección siguiente.
            </p>
          )}
          <p className="mt-2 text-sm text-orange-900/80">
            Se añadirán {currentPreview.wordsToAdd} palabras al diccionario.
            {currentPreview.wordsAlreadyInDictionary > 0
              ? ` ${currentPreview.wordsAlreadyInDictionary} ya están.`
              : ''}{' '}
            Las palabras añadidas antes no se eliminan.
          </p>
        </ConfirmModal>
      ) : null}
    </main>
  )
}

function CreateLessonModal({
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  isPending: boolean
  error: boolean
  onClose: () => void
  onSubmit: (values: CreateLessonInput) => void
}) {
  const form = useForm<CreateLessonInput>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: { title: '' },
  })

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva lección"
    >
      <form
        className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
      >
        <h2 className="text-xl font-bold tracking-tight">Nueva lección</h2>
        <p className="mt-1 text-sm text-orange-900/70">
          Introduce el nombre. Las palabras se añaden después.
        </p>

        <label className="mt-5 mb-1.5 block text-sm font-medium" htmlFor="title">
          Nombre
        </label>
        <input
          id="title"
          autoFocus
          className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
          {...form.register('title')}
        />
        {form.formState.errors.title ? (
          <p className="mt-1 text-sm text-red-700">Introduce un nombre.</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            No se pudo crear la lección.
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-orange-700 hover:bg-orange-800"
            disabled={isPending}
          >
            {isPending ? 'Creando…' : 'Crear'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ConfirmModal({
  title,
  children,
  confirmLabel,
  confirmDisabled,
  onCancel,
  onConfirm,
}: {
  title: string
  children: React.ReactNode
  confirmLabel: string
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <div className="mt-3">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-orange-700 hover:bg-orange-800"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
