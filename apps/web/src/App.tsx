import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  loginSchema,
  type AuthUser,
  type LoginInput,
  type SuggestionItem,
} from '@aprender-palabras/contracts'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiError, getCurrentUser, login, logout } from './shared/api/auth'
import { getSuggestions } from './shared/api/suggestions'

const AUTH_QUERY_KEY = ['auth', 'me'] as const
const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
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

function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY })
      queryClient.removeQueries({ queryKey: ['suggestions'] })
      navigate('/login', { replace: true })
    },
  })

  useEffect(() => {
    const trimmed = searchInput.trim()
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmed)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchInput])

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', debouncedQuery],
    queryFn: ({ signal }) => getSuggestions(debouncedQuery, signal),
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
    retry: false,
  })

  const showSuggestionsPanel = debouncedQuery.length >= MIN_QUERY_LENGTH

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
              Aprender Palabras
            </p>
            <p className="mt-1 text-sm text-orange-900/70">{user?.login}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative w-full sm:w-80">
              <label className="sr-only" htmlFor="word-search">
                Buscar palabra
              </label>
              <input
                id="word-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar palabra…"
                autoComplete="off"
                className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
              />

              {showSuggestionsPanel && (
                <div
                  className="absolute top-full right-0 left-0 z-10 mt-2 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm"
                  role="listbox"
                  aria-label="Sugerencias"
                >
                  {suggestionsQuery.isFetching && (
                    <p
                      className="px-4 py-3 text-sm text-orange-900/70"
                      role="status"
                    >
                      Buscando…
                    </p>
                  )}

                  {suggestionsQuery.isError && (
                    <p className="px-4 py-3 text-sm text-red-700" role="alert">
                      {isServiceUnavailable(suggestionsQuery.error)
                        ? 'Las sugerencias no están disponibles.'
                        : 'No se pudieron cargar las sugerencias.'}
                    </p>
                  )}

                  {suggestionsQuery.isSuccess &&
                    suggestionsQuery.data.suggestions.length === 0 && (
                      <p className="px-4 py-3 text-sm text-orange-900/70">
                        No hay sugerencias.
                      </p>
                    )}

                  {suggestionsQuery.isSuccess &&
                    suggestionsQuery.data.suggestions.length > 0 && (
                      <ul>
                        {suggestionsQuery.data.suggestions.map((item) => (
                          <SuggestionRow
                            item={item}
                            key={suggestionKey(item)}
                          />
                        ))}
                      </ul>
                    )}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              {logoutMutation.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Button>
          </div>
        </div>

        {logoutMutation.isError && (
          <p role="alert" className="px-5 pb-4 text-sm text-red-700 sm:px-8">
            No se pudo cerrar la sesión. Inténtalo de nuevo.
          </p>
        )}
      </header>
    </main>
  )
}

function SuggestionRow({ item }: { item: SuggestionItem }) {
  return (
    <li
      className="border-t border-orange-100 px-4 py-3 text-sm first:border-t-0"
      role="option"
      aria-selected={false}
    >
      <span className="font-medium">{item.spanish}</span>
      <span className="text-orange-900/50"> — </span>
      <span>{item.russian}</span>
    </li>
  )
}

function suggestionKey(item: SuggestionItem): string {
  return `${item.spanish}|${item.russian}`
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

function isServiceUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503
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
