import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { listInvitedUsers } from '@/shared/api/courses'
import { invitedUsersQueryKey } from './query-keys'

export function InvitedUsersPage({ userMenu }: { userMenu: React.ReactNode }) {
  const navigate = useNavigate()
  const invitedQuery = useQuery({
    queryKey: invitedUsersQueryKey,
    queryFn: ({ signal }) => listInvitedUsers(signal),
  })

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">Alumnos</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/cursos/gestion')}
            >
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        {invitedQuery.isPending ? (
          <p className="text-sm text-orange-900/70">Cargando…</p>
        ) : null}
        {invitedQuery.isError ? (
          <p className="text-sm text-red-700" role="alert">
            No se pudieron cargar los alumnos.
          </p>
        ) : null}
        {invitedQuery.isSuccess && invitedQuery.data.length === 0 ? (
          <p className="text-sm text-orange-900/70">
            Aún no hay alumnos.
          </p>
        ) : null}
        {invitedQuery.isSuccess && invitedQuery.data.length > 0 ? (
          <ul className="divide-y divide-orange-100">
            {invitedQuery.data.map((user) => (
              <li key={user.userId}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col gap-1 py-4 text-left hover:bg-orange-50/60"
                  onClick={() => navigate(`/cursos/alumnos/${user.userId}`)}
                >
                  <p className="font-semibold">{user.login}</p>
                  <p className="text-sm text-orange-900/60">
                    {user.courseCount === 1
                      ? '1 curso'
                      : `${user.courseCount} cursos`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  )
}
