import {
  createLessonSchema,
  type AuthUser,
  type CreateLessonInput,
  type LessonListItem,
  type SetCurrentLessonPreview,
} from '@aprender-palabras/contracts'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import {
  getCourse,
  previewMemberCurrentLesson,
  removeCourseMember,
  setMemberCurrentLesson,
  updateCourse,
} from '@/shared/api/courses'
import {
  createLesson,
  deleteLesson,
  listLessons,
  moveLesson,
} from '@/shared/api/lessons'
import { ProgressRing } from '../lessons/progress-ring'
import { lessonStatusLabel } from '../lessons/status-label'
import {
  COURSES_QUERY_KEY,
  courseLessonsQueryKey,
  courseQueryKey,
} from './query-keys'

const LESSON_PAGE_SIZE = 20

export function CourseDetailPage({
  mode,
  userMenu,
}: {
  mode: 'student' | 'creator'
  userMenu: React.ReactNode
}) {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isCreatorMode = mode === 'creator'
  const listPath = isCreatorMode ? '/cursos/gestion' : '/cursos'
  const coursePath = `${listPath}/${courseId}`
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LessonListItem | null>(null)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false)
  const [currentPreview, setCurrentPreview] =
    useState<SetCurrentLessonPreview | null>(null)

  const courseQuery = useQuery({
    queryKey: courseQueryKey(courseId),
    queryFn: ({ signal }) => getCourse(courseId, signal),
    enabled: Boolean(courseId),
  })

  const lessonsQuery = useInfiniteQuery({
    queryKey: courseLessonsQueryKey(courseId),
    queryFn: ({ pageParam, signal }) =>
      listLessons(
        courseId,
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
    enabled: Boolean(courseId),
    placeholderData: keepPreviousData,
  })

  const course = courseQuery.data
  const authUser = queryClient.getQueryData<AuthUser>(['auth', 'me'])
  const viewerUserId = authUser?.id
  const canEdit =
    isCreatorMode && (lessonsQuery.data?.pages[0]?.canEdit ?? false)
  const items = lessonsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const totalCount = lessonsQuery.data?.pages[0]?.totalCount ?? 0
  const effectivelyActive = course?.effectivelyActive ?? false
  const showStudentActions =
    !isCreatorMode &&
    course?.membershipStatus === 'accepted' &&
    effectivelyActive
  const showLeave =
    !isCreatorMode && course?.membershipStatus !== null

  const createMutation = useMutation({
    mutationFn: (input: CreateLessonInput) => createLesson(courseId, input),
    onSuccess: async (lesson) => {
      await queryClient.invalidateQueries({
        queryKey: courseLessonsQueryKey(courseId),
      })
      await queryClient.invalidateQueries({ queryKey: courseQueryKey(courseId) })
      setCreateOpen(false)
      navigate(`${coursePath}/lecciones/${lesson.id}`)
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({
      lessonId,
      direction,
    }: {
      lessonId: string
      direction: 'up' | 'down'
    }) => moveLesson(courseId, lessonId, { direction }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: courseLessonsQueryKey(courseId),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (lessonId: string) => deleteLesson(courseId, lessonId),
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({
        queryKey: courseLessonsQueryKey(courseId),
      })
      await queryClient.invalidateQueries({ queryKey: courseQueryKey(courseId) })
      await queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY })
    },
  })

  const setCurrentMutation = useMutation({
    mutationFn: (lessonId: string) => {
      if (!viewerUserId) {
        throw new Error('Missing user')
      }
      return setMemberCurrentLesson(courseId, viewerUserId, lessonId)
    },
    onSuccess: async () => {
      setCurrentPreview(null)
      await queryClient.invalidateQueries({
        queryKey: courseLessonsQueryKey(courseId),
      })
      await queryClient.invalidateQueries({ queryKey: courseQueryKey(courseId) })
      await queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['words', 'dictionary'] })
      await queryClient.invalidateQueries({ queryKey: ['training', 'today'] })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => {
      if (!viewerUserId) {
        throw new Error('Missing user')
      }
      return removeCourseMember(courseId, viewerUserId)
    },
    onSuccess: async () => {
      setLeaveConfirmOpen(false)
      await queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY })
      navigate(listPath)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (active: boolean) => updateCourse(courseId, { active }),
    onSuccess: async () => {
      setDeactivateConfirmOpen(false)
      await queryClient.invalidateQueries({ queryKey: courseQueryKey(courseId) })
      await queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY })
    },
  })

  const openMarkCurrent = (lessonId: string) => {
    if (!viewerUserId) {
      return
    }
    void previewMemberCurrentLesson(courseId, viewerUserId, lessonId).then(
      (preview) => {
        setCurrentPreview(preview)
      },
    )
  }

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h1 className="text-xl font-bold tracking-tight">
                {courseQuery.isSuccess ? courseQuery.data.title : 'Curso'}
              </h1>
              {courseQuery.isSuccess && !courseQuery.data.effectivelyActive ? (
                <span className="text-sm text-orange-900/60">(Desactivado)</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate(listPath)}>
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        {courseQuery.isSuccess && isCreatorMode && !course?.isCreator ? (
          <div role="alert">
            <p className="text-sm text-red-700">
              Solo el creador puede gestionar este curso.
            </p>
            <Button className="mt-4" onClick={() => navigate(listPath)}>
              Volver
            </Button>
          </div>
        ) : null}

        {courseQuery.isPending || lessonsQuery.isPending ? (
          <p className="text-sm text-orange-900/70" role="status">
            Cargando…
          </p>
        ) : null}

        {courseQuery.isError || lessonsQuery.isError ? (
          <div role="alert">
            <p className="text-sm text-red-700">No se pudo cargar el curso.</p>
            <Button
              className="mt-4"
              onClick={() => {
                void courseQuery.refetch()
                void lessonsQuery.refetch()
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : null}

        {course &&
        (!isCreatorMode || course.isCreator) &&
        effectivelyActive ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {isCreatorMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(`/cursos/gestion/${courseId}/participantes`)
                  }
                >
                  <Users className="size-4" aria-hidden />
                  Participantes
                </Button>
                <Button
                  variant="outline"
                  disabled={toggleActiveMutation.isPending}
                  onClick={() => setDeactivateConfirmOpen(true)}
                >
                  <PowerOff className="size-4" aria-hidden />
                  Desactivar
                </Button>
                {canEdit ? (
                  <Button
                    className="bg-orange-700 hover:bg-orange-800"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden />
                    Nueva lección
                  </Button>
                ) : null}
              </>
            ) : null}
            {showLeave ? (
              <Button
                variant="outline"
                onClick={() => setLeaveConfirmOpen(true)}
              >
                Salir del curso
              </Button>
            ) : null}
          </div>
        ) : null}

        {showLeave && !effectivelyActive ? (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setLeaveConfirmOpen(true)}
            >
              Salir del curso
            </Button>
          </div>
        ) : null}

        {isCreatorMode &&
        course?.isCreator &&
        !effectivelyActive &&
        course.active === false ? (
          <div className="mb-6">
            <Button
              variant="outline"
              disabled={toggleActiveMutation.isPending}
              onClick={() => toggleActiveMutation.mutate(true)}
            >
              <Power className="size-4" aria-hidden />
              Reactivar curso
            </Button>
          </div>
        ) : null}

        {lessonsQuery.isSuccess &&
        (!isCreatorMode || course?.isCreator) &&
        items.length === 0 ? (
          <p className="text-sm text-orange-900/70">
            {canEdit
              ? 'Aún no hay lecciones. Crea la primera.'
              : 'Este curso aún no tiene lecciones.'}
          </p>
        ) : null}

        {(!isCreatorMode || course?.isCreator) && items.length > 0 ? (
          <ul className="divide-y divide-orange-100">
            {items.map((item) => {
              const statusLabel = isCreatorMode
                ? null
                : lessonStatusLabel(item.status)
              return (
              <li
                key={item.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  onClick={() =>
                    navigate(`${coursePath}/lecciones/${item.id}`)
                  }
                >
                  {!isCreatorMode ? (
                    <ProgressRing value={item.averageProgress} />
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-semibold text-orange-950">
                      {item.position}. {item.title}
                    </p>
                    <p className="mt-1 text-sm text-orange-900/60">
                      {statusLabel ? `${statusLabel} · ` : ''}
                      {item.wordCount}{' '}
                      {item.wordCount === 1 ? 'palabra' : 'palabras'}
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {canEdit ? (
                    <>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-700"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : null}
                  {showStudentActions && item.status !== 'current' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMarkCurrent(item.id)}
                    >
                      Marcar actual
                    </Button>
                  ) : null}
                </div>
              </li>
              )
            })}
          </ul>
        ) : null}

        {lessonsQuery.hasNextPage ? (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              disabled={lessonsQuery.isFetchingNextPage}
              onClick={() => void lessonsQuery.fetchNextPage()}
            >
              {lessonsQuery.isFetchingNextPage ? 'Cargando…' : 'Mostrar más'}
            </Button>
          </div>
        ) : null}
      </section>

      {createOpen ? (
        <TitleModal
          title="Nueva lección"
          isPending={createMutation.isPending}
          error={createMutation.isError}
          onClose={() => setCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}

      {deactivateConfirmOpen ? (
        <ConfirmModal
          title="Desactivar curso"
          confirmLabel={
            toggleActiveMutation.isPending ? 'Desactivando…' : 'Desactivar'
          }
          confirmDisabled={toggleActiveMutation.isPending}
          onCancel={() => setDeactivateConfirmOpen(false)}
          onConfirm={() => toggleActiveMutation.mutate(false)}
        >
          <p className="text-sm text-orange-900/80">
            ¿Desactivar este curso? Los participantes dejarán de recibir
            palabras nuevas de este curso. Tú podrás reactivarlo. El diccionario
            no se borra.
          </p>
        </ConfirmModal>
      ) : null}

      {leaveConfirmOpen ? (
        <ConfirmModal
          title="Salir del curso"
          confirmLabel={leaveMutation.isPending ? 'Saliendo…' : 'Salir'}
          confirmDisabled={leaveMutation.isPending}
          onCancel={() => setLeaveConfirmOpen(false)}
          onConfirm={() => leaveMutation.mutate()}
        >
          <p className="text-sm text-orange-900/80">
            ¿Salir de este curso? Las palabras del diccionario no se borran.
          </p>
        </ConfirmModal>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Eliminar lección"
          confirmLabel={deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
          confirmDisabled={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        >
          <p className="text-sm text-orange-900/80">
            ¿Eliminar «{deleteTarget.title}»? Las palabras del diccionario no se
            borran.
          </p>
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
          <p className="mt-2 text-sm text-orange-900/80">
            Se añadirán {currentPreview.wordsToAdd} palabras al diccionario.
          </p>
        </ConfirmModal>
      ) : null}
    </main>
  )
}

function TitleModal({
  title,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  title: string
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
      aria-label={title}
    >
      <form
        className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
      >
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
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
            No se pudo guardar.
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
            {isPending ? 'Guardando…' : 'Crear'}
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
