import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  loginSchema,
  type AuthUser,
  type LoginInput,
} from '@aprender-palabras/contracts'
import { useForm } from 'react-hook-form'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiError, getCurrentUser, login, logout } from './shared/api/auth'
import { getTests } from './shared/api/tests'

const AUTH_QUERY_KEY = ['auth', 'me'] as const

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <TestsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  })
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user)
      navigate('/', { replace: true })
    },
  })

  if (currentUser.isPending) {
    return <FullPageStatus>Comprobando la sesión…</FullPageStatus>
  }

  if (currentUser.isSuccess) {
    return <Navigate replace to="/" />
  }

  if (!isUnauthorized(currentUser.error)) {
    return (
      <FullPageStatus role="alert">
        <p>No se pudo comprobar la sesión.</p>
        <Button className="mt-4" onClick={() => void currentUser.refetch()}>
          Reintentar
        </Button>
      </FullPageStatus>
    )
  }

  return (
    <main className="grid min-h-svh place-items-center bg-orange-50 p-5 text-orange-950">
      <section className="w-full max-w-sm rounded-2xl border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
          Aprender Palabras
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-orange-900/70">
          Introduce tu usuario y contraseña para abrir tu diccionario personal.
        </p>

        <form
          className="mt-7 space-y-5"
          onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))}
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="login">
              Usuario
            </label>
            <input
              id="login"
              autoComplete="username"
              inputMode="email"
              aria-invalid={Boolean(form.formState.errors.login)}
              className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
              {...form.register('login')}
            />
            {form.formState.errors.login && (
              <p className="mt-1 text-sm text-red-700">Introduce tu usuario.</p>
            )}
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              htmlFor="password"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-sm text-red-700">
                Introduce tu contraseña.
              </p>
            )}
          </div>

          {loginMutation.isError && (
            <p role="alert" className="text-sm text-red-700">
              {isUnauthorized(loginMutation.error)
                ? 'Usuario o contraseña incorrectos.'
                : 'No se pudo iniciar sesión. Inténtalo de nuevo.'}
            </p>
          )}

          <Button
            className="h-10 w-full bg-orange-700 hover:bg-orange-800"
            disabled={loginMutation.isPending}
            type="submit"
          >
            {loginMutation.isPending ? 'Iniciando sesión…' : 'Entrar'}
          </Button>
        </form>
      </section>
    </main>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser()

  if (currentUser.isPending) {
    return <FullPageStatus>Comprobando la sesión…</FullPageStatus>
  }

  if (currentUser.isError) {
    if (isUnauthorized(currentUser.error)) {
      return <Navigate replace to="/login" />
    }

    return (
      <FullPageStatus role="alert">
        <p>No se pudo comprobar la sesión.</p>
        <Button className="mt-4" onClick={() => void currentUser.refetch()}>
          Reintentar
        </Button>
      </FullPageStatus>
    )
  }

  return children
}

function TestsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const tests = useQuery({
    queryKey: ['tests'],
    queryFn: getTests,
    retry: false,
  })
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY })
      queryClient.removeQueries({ queryKey: ['tests'] })
      navigate('/login', { replace: true })
    },
  })

  return (
    <main className="min-h-svh bg-orange-50 p-5 text-orange-950 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
              Aprender Palabras
            </p>
            <p className="text-sm text-orange-900/70">{user?.login}</p>
          </div>
          <Button
            variant="outline"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </header>

        <h1 className="mb-6 text-4xl font-bold tracking-tight">Prueba</h1>

        {logoutMutation.isError && (
          <p role="alert" className="mb-5 text-sm text-red-700">
            No se pudo cerrar la sesión. Inténtalo de nuevo.
          </p>
        )}

        {tests.isPending && <p role="status">Cargando…</p>}

        {tests.isError && (
          <div role="alert">
            <p>No se pudieron cargar los datos.</p>
            <Button className="mt-4" onClick={() => void tests.refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {tests.data && (
          <table className="min-w-72 overflow-hidden rounded-xl bg-white text-left shadow-sm">
            <thead className="bg-orange-100 text-orange-800">
              <tr>
                <th className="px-5 py-3 font-semibold" scope="col">
                  Nombre
                </th>
                <th className="px-5 py-3 font-semibold" scope="col">
                  Tamaño
                </th>
              </tr>
            </thead>
            <tbody>
              {tests.data.map((test) => (
                <tr className="border-t border-orange-100" key={test.name}>
                  <td className="px-5 py-3 font-medium">{test.name}</td>
                  <td className="px-5 py-3">{test.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    retry: false,
  })
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

function FullPageStatus({
  children,
  role = 'status',
}: {
  children: React.ReactNode
  role?: 'alert' | 'status'
}) {
  return (
    <main
      className="grid min-h-svh place-content-center bg-orange-50 p-8 text-center text-orange-950"
      role={role}
    >
      {children}
    </main>
  )
}

export default App
