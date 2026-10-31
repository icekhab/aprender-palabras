import type { AuthUser, CourseMemberItem } from '@aprender-palabras/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Clock, Trash2, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/shared/api/auth'
import {
  getCourse,
  inviteToCourse,
  listCourseMembers,
  removeCourseMember,
  setMemberCurrentLesson,
} from '@/shared/api/courses'
import { listLessons } from '@/shared/api/lessons'
import {
  courseMembersQueryKey,
  courseQueryKey,
} from './query-keys'

export function CourseMembersPage({ userMenu }: { userMenu: React.ReactNode }) {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authUser = queryClient.getQueryData<AuthUser>(['auth', 'me'])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteLogin, setInviteLogin] = useState('')
  const [deleteMode, setDeleteMode] = useState(false)
  const [pendingRemoveIds, setPendingRemoveIds] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const courseQuery = useQuery({
    queryKey: courseQueryKey(courseId),
    queryFn: ({ signal }) => getCourse(courseId, signal),
    enabled: Boolean(courseId),
  })

  const membersQuery = useQuery({
    queryKey: courseMembersQueryKey(courseId),
    queryFn: ({ signal }) => listCourseMembers(courseId, signal),
    enabled: Boolean(courseId),
  })

  const lessonsQuery = useQuery({
    queryKey: ['courses', courseId, 'lessons', 'all'],
    queryFn: ({ signal }) =>
      listLessons(courseId, { limit: 50, offset: 0 }, signal),
    enabled: Boolean(courseId),
  })

  const setCurrentMutation = useMutation({
    mutationFn: ({
      userId,
      lessonId,
    }: {
      userId: string
      lessonId: string
    }) => setMemberCurrentLesson(courseId, userId, lessonId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: courseMembersQueryKey(courseId),
      })
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () => inviteToCourse(courseId, inviteLogin),
    onSuccess: async () => {
      setInviteOpen(false)
      setInviteLogin('')
      await queryClient.invalidateQueries({
        queryKey: courseMembersQueryKey(courseId),
      })
      await queryClient.invalidateQueries({ queryKey: courseQueryKey(courseId) })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      for (const userId of userIds) {
        await removeCourseMember(courseId, userId)
      }
    },
    onSuccess: async () => {
      setConfirmOpen(false)
      setDeleteMode(false)
      setPendingRemoveIds([])
      await queryClient.invalidateQueries({
        queryKey: courseMembersQueryKey(courseId),
      })
      await queryClient.invalidateQueries({ queryKey: courseQueryKey(courseId) })
    },
  })

  if (courseQuery.isSuccess && !courseQuery.data.isCreator) {
    return (
      <main className="min-h-svh bg-orange-50 p-8 text-orange-950">
        <p>Solo el creador puede ver los participantes.</p>
        <Button
          className="mt-4"
          onClick={() => navigate(`/cursos/gestion/${courseId}`)}
        >
          Volver
        </Button>
      </main>
    )
  }

  const course = courseQuery.data
  const lessons = lessonsQuery.data?.items ?? []
  const effectivelyActive = course?.effectivelyActive ?? false
  const canInvite =
    effectivelyActive && (course?.lessonCount ?? lessons.length) > 0
  const title = course
    ? `${course.title} · Participantes`
    : 'Participantes'
  const allMembers = membersQuery.data ?? []
  const visibleMembers = allMembers.filter(
    (member) => !pendingRemoveIds.includes(member.userId),
  )
  const pendingMembers = allMembers.filter((member) =>
    pendingRemoveIds.includes(member.userId),
  )
  const canEnterDeleteMode = allMembers.length > 0

  function enterDeleteMode() {
    setDeleteMode(true)
    setPendingRemoveIds([])
    setConfirmOpen(false)
  }

  function cancelDeleteMode() {
    setDeleteMode(false)
    setPendingRemoveIds([])
    setConfirmOpen(false)
  }

  function markForRemoval(userId: string) {
    setPendingRemoveIds((current) =>
      current.includes(userId) ? current : [...current, userId],
    )
  }

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/cursos/gestion/${courseId}`)}
            >
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap justify-start gap-2">
          {deleteMode ? (
            <>
              <Button
                className="bg-orange-700 hover:bg-orange-800"
                disabled={pendingRemoveIds.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Check className="size-4" aria-hidden />
                Guardar
              </Button>
              <Button variant="outline" onClick={cancelDeleteMode}>
                <X className="size-4" aria-hidden />
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button
                className="bg-orange-700 hover:bg-orange-800"
                disabled={!canInvite}
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="size-4" aria-hidden />
                Invitar
              </Button>
              <Button
                variant="outline"
                disabled={!canEnterDeleteMode}
                onClick={enterDeleteMode}
              >
                <Trash2 className="size-4" aria-hidden />
                Eliminar
              </Button>
            </>
          )}
        </div>

        {membersQuery.isPending ? (
          <p className="text-sm text-orange-900/70">Cargando…</p>
        ) : null}
        {membersQuery.isError ? (
          <p className="text-sm text-red-700" role="alert">
            No se pudieron cargar los participantes.
          </p>
        ) : null}
        {membersQuery.isSuccess ? (
          <ul className="divide-y divide-orange-100">
            {visibleMembers.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                lessons={lessons}
                effectivelyActive={effectivelyActive}
                isSelf={member.userId === authUser?.id}
                deleteMode={deleteMode}
                onSetCurrent={(lessonId) =>
                  setCurrentMutation.mutate({
                    userId: member.userId,
                    lessonId,
                  })
                }
                onOpenUser={() =>
                  navigate(`/cursos/alumnos/${member.userId}`, {
                    state: {
                      backTo: `/cursos/gestion/${courseId}/participantes`,
                    },
                  })
                }
                onMarkRemove={() => markForRemoval(member.userId)}
              />
            ))}
          </ul>
        ) : null}
        {membersQuery.isSuccess &&
        deleteMode &&
        visibleMembers.length === 0 &&
        pendingRemoveIds.length > 0 ? (
          <p className="mt-4 text-sm text-orange-900/70">
            Pulsa Guardar para confirmar o Cancelar para deshacer.
          </p>
        ) : null}
      </section>

      {confirmOpen ? (
        <ConfirmModal
          title="Quitar del curso"
          confirmLabel={
            removeMutation.isPending ? 'Quitando…' : 'Quitar'
          }
          confirmDisabled={removeMutation.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => removeMutation.mutate(pendingRemoveIds)}
        >
          <p className="text-sm text-orange-900/80">
            {pendingMembers.length === 1
              ? `¿Quitar a ${pendingMembers[0]?.login} del curso?`
              : `¿Quitar a ${pendingMembers.length} participantes del curso?`}{' '}
            Las palabras del diccionario no se borran.
          </p>
          {removeMutation.isError ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              No se pudieron quitar algunos participantes.
            </p>
          ) : null}
        </ConfirmModal>
      ) : null}

      {inviteOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Invitar"
        >
          <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-bold">Invitar</h2>
            <label
              className="mt-5 mb-1.5 block text-sm font-medium"
              htmlFor="invite-login"
            >
              Usuario
            </label>
            <input
              id="invite-login"
              autoFocus
              value={inviteLogin}
              onChange={(event) => setInviteLogin(event.target.value)}
              className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
            />
            {inviteMutation.isError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {inviteMutation.error instanceof ApiError &&
                inviteMutation.error.status === 409
                  ? 'Este usuario ya fue invitado.'
                  : 'No se pudo invitar. Comprueba el usuario.'}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setInviteOpen(false)
                  setInviteLogin('')
                }}
              >
                Cancelar
              </Button>
              <Button
                className="bg-orange-700 hover:bg-orange-800"
                disabled={inviteMutation.isPending || inviteLogin.trim() === ''}
                onClick={() => inviteMutation.mutate()}
              >
                {inviteMutation.isPending ? 'Enviando…' : 'Invitar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function MemberRow({
  member,
  lessons,
  effectivelyActive,
  isSelf,
  deleteMode,
  onSetCurrent,
  onOpenUser,
  onMarkRemove,
}: {
  member: CourseMemberItem
  lessons: Array<{ id: string; title: string; position: number }>
  effectivelyActive: boolean
  isSelf: boolean
  deleteMode: boolean
  onSetCurrent: (lessonId: string) => void
  onOpenUser: () => void
  onMarkRemove: () => void
}) {
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {deleteMode ? (
          <button
            type="button"
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-red-700 hover:bg-red-50"
            aria-label={`Quitar a ${member.login}`}
            onClick={onMarkRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0">
          <button
            type="button"
            className="font-semibold text-orange-950 hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
            disabled={deleteMode}
            onClick={onOpenUser}
          >
            {member.login}
            {isSelf ? ' (tú)' : ''}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {member.status === 'pending' ? (
          <p className="flex h-9 items-center gap-2 text-sm text-amber-800">
            <Clock className="size-4 shrink-0" aria-hidden />
            Espera confirmación
          </p>
        ) : null}
        {effectivelyActive && member.status === 'accepted' ? (
          <>
            <label className="sr-only" htmlFor={`current-${member.userId}`}>
              Lección actual
            </label>
            <div className="relative">
              <select
                id={`current-${member.userId}`}
                disabled={deleteMode}
                className="h-9 appearance-none rounded-lg border border-orange-200 bg-white py-0 pr-8 pl-3 text-sm outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
                value={member.currentLessonId ?? ''}
                onChange={(event) => {
                  if (event.target.value) {
                    onSetCurrent(event.target.value)
                  }
                }}
              >
                <option value="" disabled>
                  Elegir lección
                </option>
                {lessons.map((lesson) => (
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
          </>
        ) : null}
      </div>
    </li>
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
