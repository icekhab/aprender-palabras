import {
  createCourseSchema,
  type CourseListItem,
  type CreateCourseInput,
} from '@aprender-palabras/contracts'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import {
  acceptCourse,
  createCourse,
  listCourses,
  rejectCourse,
} from '@/shared/api/courses'
import { COURSES_QUERY_KEY, coursesListQueryKey } from './query-keys'

export function CoursesPage({
  mode,
  userMenu,
}: {
  mode: 'student' | 'creator'
  userMenu: React.ReactNode
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const isCreatorMode = mode === 'creator'
  const title = isCreatorMode ? 'Gestión de cursos' : 'Mis cursos'
  const courseBasePath = isCreatorMode ? '/cursos/gestion' : '/cursos'

  const coursesQuery = useQuery({
    queryKey: coursesListQueryKey(mode),
    queryFn: ({ signal }) => listCourses(mode, signal),
  })

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: async (course) => {
      await queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY })
      setCreateOpen(false)
      navigate(`/cursos/gestion/${course.id}`)
    },
  })

  const acceptMutation = useMutation({
    mutationFn: acceptCourse,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: rejectCourse,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY })
    },
  })

  const pending = isCreatorMode ? [] : (coursesQuery.data?.pending ?? [])
  const items = coursesQuery.data?.items ?? []
  const isEmpty =
    coursesQuery.isSuccess && items.length === 0 && pending.length === 0

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
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
        {!isEmpty ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookOpen className="size-6 text-orange-700" aria-hidden />
              <p className="text-sm text-orange-900/60">
                {coursesQuery.isSuccess
                  ? items.length === 1
                    ? '1 curso'
                    : `${items.length} cursos`
                  : 'Tus cursos'}
              </p>
            </div>
            {isCreatorMode ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/cursos/alumnos')}
                >
                  <Users className="size-4" aria-hidden />
                  Alumnos
                </Button>
                <Button
                  className="bg-orange-700 hover:bg-orange-800"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" aria-hidden />
                  Nuevo curso
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {coursesQuery.isPending ? (
          <p className="mt-8 text-sm text-orange-900/70" role="status">
            Cargando los cursos…
          </p>
        ) : null}

        {coursesQuery.isError ? (
          <div className="mt-8" role="alert">
            <p className="text-sm text-red-700">No se pudieron cargar los cursos.</p>
            <Button className="mt-4" onClick={() => void coursesQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {pending.length > 0 ? (
          <div className="mt-8 space-y-3">
            <h2 className="text-lg font-semibold">Invitaciones</h2>
            <ul className="divide-y divide-orange-100 rounded-2xl border border-orange-100 bg-white">
              {pending.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{invite.title}</p>
                    <p className="mt-1 text-sm text-orange-900/60">
                      De {invite.createdByLogin}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(invite.id)}
                    >
                      Rechazar
                    </Button>
                    <Button
                      className="bg-orange-700 hover:bg-orange-800"
                      disabled={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate(invite.id)}
                    >
                      Aceptar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <BookOpen
              className="size-14 text-orange-300"
              aria-hidden
              strokeWidth={1.25}
            />
            <p className="mt-4 text-base font-medium text-orange-900/70">
              Aún no hay cursos
            </p>
            {isCreatorMode ? (
              <Button
                className="mt-6 bg-orange-700 hover:bg-orange-800"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                Nuevo curso
              </Button>
            ) : null}
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="mt-8 divide-y divide-orange-100">
            {items.map((item) => (
              <CourseRow
                key={item.id}
                item={item}
                mode={mode}
                courseBasePath={courseBasePath}
              />
            ))}
          </ul>
        ) : null}
      </section>

      {createOpen ? (
        <CreateCourseModal
          isPending={createMutation.isPending}
          error={createMutation.isError}
          onClose={() => setCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}
    </main>
  )
}

function CourseRow({
  item,
  mode,
  courseBasePath,
}: {
  item: CourseListItem
  mode: 'student' | 'creator'
  courseBasePath: string
}) {
  const navigate = useNavigate()
  const canOpen =
    mode === 'creator' ? true : item.effectivelyActive
  const statusLabel =
    mode === 'creator'
      ? item.effectivelyActive
        ? item.lessonCount === 1
          ? '1 lección'
          : `${item.lessonCount} lecciones`
        : 'Desactivado'
      : !item.effectivelyActive
        ? 'Desactivado'
        : item.currentLessonTitle
          ? item.currentLessonTitle
          : 'Sin lección actual'

  return (
    <li>
      <button
        type="button"
        disabled={!canOpen}
        className={
          canOpen
            ? 'flex w-full cursor-pointer flex-col gap-1 py-4 text-left hover:bg-orange-50/60'
            : 'flex w-full cursor-default flex-col gap-1 py-4 text-left opacity-70'
        }
        onClick={() => {
          if (canOpen) {
            navigate(`${courseBasePath}/${item.id}`)
          }
        }}
      >
        <p className="font-semibold text-orange-950">{item.title}</p>
        <p className="text-sm text-orange-900/60">
          {statusLabel}
          {mode === 'student' ? (
            <>
              {' · '}
              {item.lessonCount === 1
                ? '1 lección'
                : `${item.lessonCount} lecciones`}
            </>
          ) : item.effectivelyActive ? null : (
            <>
              {' · '}
              {item.lessonCount === 1
                ? '1 lección'
                : `${item.lessonCount} lecciones`}
            </>
          )}
        </p>
      </button>
    </li>
  )
}

function CreateCourseModal({
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  isPending: boolean
  error: boolean
  onClose: () => void
  onSubmit: (values: CreateCourseInput) => void
}) {
  const form = useForm<CreateCourseInput>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { title: '' },
  })

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo curso"
    >
      <form
        className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
      >
        <h2 className="text-xl font-bold tracking-tight">Nuevo curso</h2>
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
            No se pudo crear el curso.
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
