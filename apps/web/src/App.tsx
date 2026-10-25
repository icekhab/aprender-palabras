import { zodResolver } from '@hookform/resolvers/zod'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  loginSchema,
  type AuthUser,
  type DailyTrainerItem,
  type DictionaryListItem,
  type LoginInput,
  type SuggestionItem,
  type SuggestionsResponse,
} from '@aprender-palabras/contracts'
import { BookOpen, Library, LogOut, Plus, Settings } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppSplash } from '@/components/app-splash'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { ProgressDot } from '@/components/progress-dot'
import { WordRow } from '@/components/word-row'
import { AdminWordEditPage } from './pages/admin/AdminWordEditPage'
import { AdminWordNewPage } from './pages/admin/AdminWordNewPage'
import { AdminWordsPage } from './pages/admin/AdminWordsPage'
import { LessonDetailPage } from './pages/lessons/LessonDetailPage'
import { LessonsPage } from './pages/lessons/LessonsPage'
import { TrainerSessionPage } from './pages/training/TrainerSessionPage'
import { AddWordPage } from './pages/words/AddWordPage'
import { WordCardEditPage } from './pages/words/WordCardEditPage'
import { WordCardPage } from './pages/words/WordCardPage'
import { ApiError, getCurrentUser, login, logout } from './shared/api/auth'
import { getSuggestions } from './shared/api/suggestions'
import { getTodayTraining } from './shared/api/training'
import { addExistingWord, listDictionaryWords } from './shared/api/words'

const AUTH_QUERY_KEY = ['auth', 'me'] as const
const DICTIONARY_QUERY_KEY = ['words', 'dictionary'] as const
const TRAINING_TODAY_QUERY_KEY = ['training', 'today'] as const
const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const DICTIONARY_PAGE_SIZE = 20

const TRAINER_CARD_COLORS = [
  'bg-orange-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-teal-700',
  'bg-sky-700',
  'bg-lime-700',
] as const

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
      <Route
        path="/words/new"
        element={
          <ProtectedRoute>
            <AddWordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/words/:cardId/edit"
        element={
          <ProtectedRoute>
            <WordCardEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/words/:cardId"
        element={
          <ProtectedRoute>
            <WordCardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/words"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminWordsRoutePage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/words/new"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminWordNewPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/words/:wordId/edit"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminWordEditPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/lecciones"
        element={
          <ProtectedRoute>
            <LessonsRoutePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lecciones/:id"
        element={
          <ProtectedRoute>
            <LessonDetailRoutePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entrenamiento/:trainerId"
        element={
          <ProtectedRoute>
            <TrainerSessionPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

function LessonsRoutePage() {
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const logoutMutation = useLogoutMutation()

  return (
    <LessonsPage
      userMenu={
        user ? (
          <UserMenu user={user} logoutMutation={logoutMutation} />
        ) : null
      }
    />
  )
}

function LessonDetailRoutePage() {
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const logoutMutation = useLogoutMutation()

  return (
    <LessonDetailPage
      userMenu={
        user ? (
          <UserMenu user={user} logoutMutation={logoutMutation} />
        ) : null
      }
    />
  )
}

function AdminWordsRoutePage() {
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const logoutMutation = useLogoutMutation()

  return (
    <AdminWordsPage
      userMenu={
        user ? (
          <UserMenu user={user} logoutMutation={logoutMutation} />
        ) : null
      }
    />
  )
}

function AdminRoute({ children }: { children: ReactNode }) {
  const currentUser = useCurrentUser()

  if (currentUser.isPending) {
    return <AppSplash />
  }

  if (currentUser.data?.role !== 'admin') {
    return <Navigate replace to="/" />
  }

  return children
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
    return <SessionLoader />
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
    return <SessionLoader />
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
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [dictionaryFilterInput, setDictionaryFilterInput] = useState('')
  const [debouncedDictionaryFilter, setDebouncedDictionaryFilter] =
    useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const logoutMutation = useLogoutMutation()

  useEffect(() => {
    const trimmed = searchInput.trim()
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmed)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchInput])

  useEffect(() => {
    const trimmed = dictionaryFilterInput.trim()
    const timeoutId = window.setTimeout(() => {
      setDebouncedDictionaryFilter(trimmed)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [dictionaryFilterInput])

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', debouncedQuery],
    queryFn: ({ signal }) => getSuggestions(debouncedQuery, signal),
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
    retry: false,
  })

  const showSuggestionsPanel =
    searchFocused && debouncedQuery.length >= MIN_QUERY_LENGTH

  const dictionaryQuery = useInfiniteQuery({
    queryKey: [...DICTIONARY_QUERY_KEY, debouncedDictionaryFilter],
    queryFn: ({ pageParam, signal }) =>
      listDictionaryWords(
        {
          limit: DICTIONARY_PAGE_SIZE,
          offset: pageParam,
          q: debouncedDictionaryFilter || undefined,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + DICTIONARY_PAGE_SIZE : undefined,
    placeholderData: keepPreviousData,
  })

  const trainingQuery = useQuery({
    queryKey: TRAINING_TODAY_QUERY_KEY,
    queryFn: ({ signal }) => getTodayTraining(signal),
  })

  const dictionaryPages = dictionaryQuery.data?.pages
  const totalCount = dictionaryPages?.[0]?.totalCount ?? 0
  const averageProgress = dictionaryPages?.[0]?.averageProgress ?? 0
  const dictionaryItems = dictionaryPages?.flatMap((page) => page.items) ?? []

  if (trainingQuery.isPending || dictionaryQuery.isPending) {
    return <AppSplash />
  }

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <BrandLink />
          </div>

          <div className="flex items-start gap-3">
            <div
              className="relative w-full sm:w-80"
              onFocus={() => {
                setSearchFocused(true)
              }}
              onBlur={(event) => {
                const root = event.currentTarget
                const next = event.relatedTarget as Node | null
                // iOS often reports relatedTarget=null before the suggestion
                // tap lands; defer so pointer handlers can run first.
                window.setTimeout(() => {
                  if (next && root.contains(next)) {
                    return
                  }
                  if (root.contains(document.activeElement)) {
                    return
                  }
                  setSearchFocused(false)
                }, 0)
              }}
            >
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

            {user ? (
              <UserMenu user={user} logoutMutation={logoutMutation} />
            ) : null}
          </div>
        </div>

        {logoutMutation.isError ? (
          <p role="alert" className="px-5 pb-4 text-sm text-red-700 sm:px-8">
            No se pudo cerrar la sesión. Inténtalo de nuevo.
          </p>
        ) : null}
      </header>

      {trainingQuery.isError ||
      (trainingQuery.isSuccess && trainingQuery.data.trainers.length > 0) ? (
        <section className="mx-auto max-w-5xl px-5 pt-8 sm:px-8">
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight">
              Entrenamiento diario
            </h1>
          </div>

          {trainingQuery.isError && (
            <div className="mt-4" role="alert">
              <p className="text-sm text-red-700">
                No se pudo cargar el entrenamiento.
              </p>
              <Button
                className="mt-3"
                onClick={() => void trainingQuery.refetch()}
              >
                Reintentar
              </Button>
            </div>
          )}

          {trainingQuery.isSuccess && trainingQuery.data.trainers.length > 0 ? (
            <DailyTrainerRow trainers={trainingQuery.data.trainers} />
          ) : null}
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-4">
          <ProgressRing value={averageProgress} />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Diccionario</h2>
            <p className="mt-1 text-sm text-orange-900/60">
              {totalCount === 1
                ? '1 palabra añadida'
                : `${totalCount} palabras añadidas`}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label className="sr-only" htmlFor="dictionary-filter">
            Buscar en tu diccionario
          </label>
          <input
            id="dictionary-filter"
            value={dictionaryFilterInput}
            onChange={(event) => setDictionaryFilterInput(event.target.value)}
            placeholder="Buscar en tu diccionario…"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200 sm:max-w-md"
          />
        </div>

        {dictionaryQuery.isError && (
          <div className="mt-4" role="alert">
            <p className="text-sm text-red-700">
              No se pudo cargar el diccionario.
            </p>
            <Button
              className="mt-4"
              onClick={() => void dictionaryQuery.refetch()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {dictionaryQuery.isSuccess &&
          dictionaryItems.length === 0 &&
          debouncedDictionaryFilter.length > 0 && (
            <p className="mt-4 text-sm text-orange-900/70">
              No hay coincidencias.
            </p>
          )}

        {dictionaryQuery.isSuccess &&
          dictionaryItems.length === 0 &&
          debouncedDictionaryFilter.length === 0 && (
            <p className="mt-4 text-sm text-orange-900/70">
              Aún no hay palabras. Busca una arriba para añadirla.
            </p>
          )}

        {dictionaryQuery.isSuccess && dictionaryItems.length > 0 && (
          <>
            <ul className="mt-4">
              {dictionaryItems.map((item) => (
                <DictionaryWordRow item={item} key={item.id} />
              ))}
            </ul>

            {dictionaryQuery.hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  disabled={dictionaryQuery.isFetchingNextPage}
                  onClick={() => void dictionaryQuery.fetchNextPage()}
                >
                  {dictionaryQuery.isFetchingNextPage
                    ? 'Cargando…'
                    : 'Mostrar más'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  )
}

function DailyTrainerRow({ trainers }: { trainers: DailyTrainerItem[] }) {
  const navigate = useNavigate()

  return (
    <ul
      className="-mx-5 mt-5 flex gap-3 overflow-x-auto px-5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
      aria-label="Entrenamientos de hoy"
    >
      {trainers.map((trainer) => {
        const isDaily = trainer.kind === 'daily'
        const colorIndex = isDaily
          ? Math.max(0, trainer.slot - 1)
          : 0
        const color =
          TRAINER_CARD_COLORS[colorIndex % TRAINER_CARD_COLORS.length] ??
          TRAINER_CARD_COLORS[0]
        const wordLabel =
          trainer.wordCount === 1
            ? '1 palabra'
            : `${trainer.wordCount} palabras`

        return (
          <li key={trainer.id} className="shrink-0">
            <button
              type="button"
              className={`${color} relative flex h-40 w-40 cursor-pointer flex-col justify-between rounded-2xl p-4 text-left text-white shadow-sm transition hover:brightness-105`}
              aria-label={`${trainer.sourceLabel}, ${wordLabel}`}
              onClick={() => {
                void navigate(`/entrenamiento/${trainer.id}`)
              }}
            >
              {isDaily ? (
                <span className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-white/95 text-sm font-bold text-orange-950">
                  {trainer.slot}
                </span>
              ) : null}
              <p
                className={`text-sm leading-snug font-semibold ${isDaily ? 'pr-8' : ''}`}
              >
                {trainer.sourceLabel}
              </p>
              <p className="text-sm font-medium text-white/90">{wordLabel}</p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ProgressRing({ value }: { value: number }) {
  const size = 56
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Progreso medio ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-orange-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-orange-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-orange-950">
        {clamped}%
      </span>
    </div>
  )
}

function DictionaryWordRow({ item }: { item: DictionaryListItem }) {
  const navigate = useNavigate()

  return (
    <WordRow
      spanish={item.spanish}
      russian={item.russian}
      progress={item.progress}
      onSelect={() => {
        void navigate(`/words/${item.id}`)
      }}
    />
  )
}

function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const logoutMutation = useLogoutMutation()

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">Ajustes</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>
              Volver
            </Button>
            {user ? (
              <UserMenu user={user} logoutMutation={logoutMutation} />
            ) : null}
          </div>
        </div>
        {logoutMutation.isError ? (
          <p role="alert" className="px-5 pb-4 text-sm text-red-700 sm:px-8">
            No se pudo cerrar la sesión. Inténtalo de nuevo.
          </p>
        ) : null}
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 sm:px-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pronunciación</h2>
          <p className="text-sm text-orange-900/70">
            Las palabras se escuchan con la voz integrada de la aplicación.
          </p>
        </section>
      </div>
    </main>
  )
}

function UserMenu({
  user,
  logoutMutation,
}: {
  user: AuthUser
  logoutMutation: ReturnType<typeof useLogoutMutation>
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initial = user.login.trim().charAt(0).toLocaleUpperCase() || '?'

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Cuenta"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-orange-700 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
        onClick={() => {
          setOpen((current) => !current)
        }}
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Cuenta"
          className="absolute top-full right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm hover:bg-orange-50"
            onClick={() => {
              setOpen(false)
              navigate('/lecciones')
            }}
          >
            <BookOpen className="size-4 shrink-0" aria-hidden />
            Lecciones
          </button>
          {user.role === 'admin' ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 border-t border-orange-100 px-4 py-3 text-left text-sm hover:bg-orange-50"
              onClick={() => {
                setOpen(false)
                navigate('/admin/words')
              }}
            >
              <Library className="size-4 shrink-0" aria-hidden />
              Todas las palabras
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 border-t border-orange-100 px-4 py-3 text-left text-sm hover:bg-orange-50"
            onClick={() => {
              setOpen(false)
              navigate('/settings')
            }}
          >
            <Settings className="size-4 shrink-0" aria-hidden />
            Ajustes
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 border-t border-orange-100 px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={logoutMutation.isPending}
            onClick={() => {
              setOpen(false)
              logoutMutation.mutate()
            }}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {logoutMutation.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function useLogoutMutation() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY })
      queryClient.removeQueries({ queryKey: ['suggestions'] })
      queryClient.removeQueries({ queryKey: DICTIONARY_QUERY_KEY })
      queryClient.removeQueries({ queryKey: ['lessons'] })
      navigate('/login', { replace: true })
    },
  })
}

function SuggestionRow({ item }: { item: SuggestionItem }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = new URLSearchParams({
    spanish: item.spanish,
    russian: item.russian,
  })

  const addMutation = useMutation({
    mutationFn: () => {
      if (!item.wordId) {
        throw new Error('Missing word id')
      }

      return addExistingWord({ wordId: item.wordId })
    },
    onSuccess: async (card) => {
      queryClient.setQueriesData<SuggestionsResponse>(
        { queryKey: ['suggestions'] },
        (current) => {
          if (!current) {
            return current
          }

          return {
            suggestions: current.suggestions.map((suggestion) =>
              suggestion.wordId === card.wordId
                ? { ...suggestion, progress: card.progress }
                : suggestion,
            ),
          }
        },
      )
      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
    },
  })

  const label = `${item.spanish} — ${item.russian}`
  const inDictionary = item.wordId !== null && item.progress !== null
  const canQuickAdd = item.wordId !== null && item.progress === null

  const text = (
    <span className="min-w-0 flex-1 text-base">
      <span className="font-medium">{item.spanish}</span>
      <span className="text-orange-900/50"> — </span>
      <span>{item.russian}</span>
    </span>
  )

  if (item.wordId === null) {
    return (
      <li className="border-t border-orange-100 first:border-t-0" role="option">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-orange-50"
          onMouseDown={keepSearchFocus}
          onPointerDown={keepSearchFocus}
          onClick={() => {
            navigate(`/words/new?${params}`)
          }}
        >
          {text}
        </button>
      </li>
    )
  }

  if (canQuickAdd) {
    return (
      <li className="border-t border-orange-100 first:border-t-0" role="option">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Añadir ${label}`}
          disabled={addMutation.isPending}
          onMouseDown={keepSearchFocus}
          onPointerDown={keepSearchFocus}
          onClick={() => {
            addMutation.mutate()
          }}
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
    <li
      className="flex items-center gap-2 border-t border-orange-100 px-4 py-3 first:border-t-0"
      role="option"
    >
      {text}
      {inDictionary ? (
        <SuggestionProgressIcon
          progress={item.progress ?? 0}
          wordLabel={label}
        />
      ) : null}
    </li>
  )
}

function SuggestionProgressIcon({
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

function suggestionKey(item: SuggestionItem): string {
  return `${item.spanish}|${item.russian}`
}

/** Prevents the search input from blurring before a suggestion click (iOS). */
function keepSearchFocus(
  event: ReactMouseEvent | ReactPointerEvent,
): void {
  event.preventDefault()
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

function SessionLoader() {
  return <AppSplash />
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
