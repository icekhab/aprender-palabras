import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Clock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import {
  getInvitedUserDetail,
  removeCourseMember,
  setMemberCurrentLesson,
} from '@/shared/api/courses'
import { listLessons } from '@/shared/api/lessons'
import { invitedUserQueryKey, invitedUsersQueryKey } from './query-keys'

export function InvitedUserDetailPage({
  userMenu,
}: {
  userMenu: React.ReactNode
}) {
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [removeCourseId, setRemoveCourseId] = useState<string | null>(null)
  const backTo =
    typeof (location.state as { backTo?: unknown } | null)?.backTo === 'string'
      ? (location.state as { backTo: string }).backTo
      : '/cursos/alumnos'

  const detailQuery = useQuery({
    queryKey: invitedUserQueryKey(userId),
    queryFn: ({ signal }) => getInvitedUserDetail(userId, signal),
    enabled: Boolean(userId),
  })

  const setCurrentMutation = useMutation({
    mutationFn: ({
      courseId,
      lessonId,
    }: {
      courseId: string
      lessonId: string
    }) => setMemberCurrentLesson(courseId, userId, lessonId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: invitedUserQueryKey(userId),
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (courseId: string) => removeCourseMember(courseId, userId),
    onSuccess: async () => {
      setRemoveCourseId(null)
      await queryClient.invalidateQueries({
        queryKey: invitedUserQueryKey(userId),
      })
      await queryClient.invalidateQueries({ queryKey: invitedUsersQueryKey })
    },
  })

  const removeCourseTitle =
    detailQuery.data?.courses.find(
      (course) => course.courseId === removeCourseId,
    )?.title ?? null

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              {detailQuery.data?.login ?? 'Usuario'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:px-8">
        {detailQuery.isPending ? (
          <p className="text-sm text-orange-900/70">Cargando…</p>
        ) : null}
        {detailQuery.isError ? (
          <p className="text-sm text-red-700" role="alert">
            No se pudo cargar el usuario.
          </p>
        ) : null}
        {detailQuery.isSuccess && detailQuery.data.courses.length === 0 ? (
          <p className="text-sm text-orange-900/70">
            Este usuario ya no está en tus cursos.
          </p>
        ) : null}
        {detailQuery.isSuccess
          ? detailQuery.data.courses.map((course) => (
              <CourseBlock
                key={course.courseId}
                course={course}
                onSetCurrent={(lessonId) =>
                  setCurrentMutation.mutate({
                    courseId: course.courseId,
                    lessonId,
                  })
                }
                onRemove={() => setRemoveCourseId(course.courseId)}
              />
            ))
          : null}
      </section>

      {removeCourseId ? (
        <ConfirmModal
          title="Quitar del curso"
          confirmLabel={removeMutation.isPending ? 'Quitando…' : 'Quitar'}
          confirmDisabled={removeMutation.isPending}
          onCancel={() => setRemoveCourseId(null)}
          onConfirm={() => removeMutation.mutate(removeCourseId)}
        >
          <p className="text-sm text-orange-900/80">
            ¿Quitar a {detailQuery.data?.login} de «{removeCourseTitle}»? Las
            palabras del diccionario no se borran.
          </p>
        </ConfirmModal>
      ) : null}
    </main>
  )
}

function CourseBlock({
  course,
  onSetCurrent,
  onRemove,
}: {
  course: {
    courseId: string
    title: string
    effectivelyActive: boolean
    status: string
    currentLessonId: string | null
    currentLessonTitle: string | null
    currentLessonPosition: number | null
    nextLessonTitle: string | null
  }
  onSetCurrent: (lessonId: string) => void
  onRemove: () => void
}) {
  const lessonsQuery = useQuery({
    queryKey: ['courses', course.courseId, 'lessons', 'all'],
    queryFn: ({ signal }) =>
      listLessons(course.courseId, { limit: 50, offset: 0 }, signal),
    enabled: course.effectivelyActive && course.status !== 'pending',
  })

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{course.title}</h2>
          {!course.effectivelyActive ? (
            <p className="mt-1 text-sm text-orange-900/60">Desactivado</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {course.status === 'pending' ? (
            <p className="flex h-9 items-center gap-2 text-sm text-amber-800">
              <Clock className="size-4 shrink-0" aria-hidden />
              Espera confirmación
            </p>
          ) : null}
          {course.effectivelyActive && course.status === 'accepted' ? (
            <div className="relative">
              <select
                className="h-9 appearance-none rounded-lg border border-orange-200 bg-white py-0 pr-8 pl-3 text-sm outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
                value={course.currentLessonId ?? ''}
                onChange={(event) => {
                  if (event.target.value) {
                    onSetCurrent(event.target.value)
                  }
                }}
              >
                <option value="" disabled>
                  Elegir lección
                </option>
                {(lessonsQuery.data?.items ?? []).map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.position}. {lesson.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-orange-700"
                aria-hidden
              />
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-red-700"
            aria-label={`Quitar de ${course.title}`}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
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
