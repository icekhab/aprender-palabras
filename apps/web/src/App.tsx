import { zodResolver } from '@hookform/resolvers/zod'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  loginSchema,
  type AuthUser,
  type DictionaryListItem,
  type LoginInput,
  type SuggestionItem,
  type WordDraft,
} from '@aprender-palabras/contracts'
import { Check, LogOut, Settings, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiError, getCurrentUser, login, logout } from './shared/api/auth'
import { getSuggestions } from './shared/api/suggestions'
import {
  createWord,
  listDictionaryWords,
  previewWord,
} from './shared/api/words'
import {
  getPreferredSpanishVoiceURI,
  getSpanishVoices,
  setPreferredSpanishVoiceURI,
  speakSpanish,
} from './shared/speech'

const AUTH_QUERY_KEY = ['auth', 'me'] as const
const DICTIONARY_QUERY_KEY = ['words', 'dictionary'] as const
const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const DICTIONARY_PAGE_SIZE = 20

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
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
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
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
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

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', debouncedQuery],
    queryFn: ({ signal }) => getSuggestions(debouncedQuery, signal),
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
    retry: false,
  })

  const showSuggestionsPanel = debouncedQuery.length >= MIN_QUERY_LENGTH

  const dictionaryQuery = useInfiniteQuery({
    queryKey: DICTIONARY_QUERY_KEY,
    queryFn: ({ pageParam, signal }) =>
      listDictionaryWords(
        { limit: DICTIONARY_PAGE_SIZE, offset: pageParam },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + DICTIONARY_PAGE_SIZE : undefined,
  })

  const dictionaryPages = dictionaryQuery.data?.pages
  const totalCount = dictionaryPages?.[0]?.totalCount ?? 0
  const averageProgress = dictionaryPages?.[0]?.averageProgress ?? 0
  const dictionaryItems = dictionaryPages?.flatMap((page) => page.items) ?? []

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

          <div className="flex items-start gap-3">
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

            {user ? (
              <UserMenu
                userLogin={user.login}
                logoutMutation={logoutMutation}
              />
            ) : null}
          </div>
        </div>

        {logoutMutation.isError ? (
          <p role="alert" className="px-5 pb-4 text-sm text-red-700 sm:px-8">
            No se pudo cerrar la sesión. Inténtalo de nuevo.
          </p>
        ) : null}
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-4">
          <ProgressRing value={averageProgress} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Diccionario</h1>
            <p className="mt-1 text-sm text-orange-900/60">
              {totalCount === 1
                ? '1 palabra añadida'
                : `${totalCount} palabras añadidas`}
            </p>
          </div>
        </div>

        {dictionaryQuery.isPending && (
          <p className="mt-8 text-sm text-orange-900/70" role="status">
            Cargando el diccionario…
          </p>
        )}

        {dictionaryQuery.isError && (
          <div className="mt-8" role="alert">
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

        {dictionaryQuery.isSuccess && dictionaryItems.length === 0 && (
          <p className="mt-8 text-sm text-orange-900/70">
            Aún no hay palabras. Busca una arriba para añadirla.
          </p>
        )}

        {dictionaryQuery.isSuccess && dictionaryItems.length > 0 && (
          <>
            <ul className="mt-8">
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
  const mastered = item.progress >= 100

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-x-3 py-3.5">
      <span className="shrink-0 self-center" aria-hidden>
        {mastered ? (
          <span className="grid size-5 place-items-center rounded-full bg-orange-700 text-white">
            <Check className="size-3 stroke-[3]" />
          </span>
        ) : (
          <span className="block size-5 rounded-full border border-dashed border-orange-300" />
        )}
      </span>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="font-medium text-orange-950">{item.spanish}</span>
        <span
          className="min-w-4 flex-1 border-b border-dotted border-orange-200"
          aria-hidden
        />
      </span>
      <span className="min-w-0 text-orange-900/55">
        {item.russian}
        <span className="sr-only">
          {mastered ? ', dominada' : `, progreso ${item.progress}%`}
        </span>
      </span>
    </li>
  )
}

function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = queryClient.getQueryData<AuthUser>(AUTH_QUERY_KEY)
  const logoutMutation = useLogoutMutation()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(
    () => getPreferredSpanishVoiceURI() ?? '',
  )

  useEffect(() => {
    const syncVoices = () => {
      const spanishVoices = getSpanishVoices()
      setVoices(spanishVoices)

      setSelectedVoiceURI((current) => {
        if (
          current &&
          spanishVoices.some((voice) => voice.voiceURI === current)
        ) {
          return current
        }

        const stored = getPreferredSpanishVoiceURI()
        if (
          stored &&
          spanishVoices.some((voice) => voice.voiceURI === stored)
        ) {
          return stored
        }

        return spanishVoices[0]?.voiceURI ?? ''
      })
    }

    syncVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', syncVoices)

    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', syncVoices)
    }
  }, [])

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
              Aprender Palabras
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Ajustes</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>
              Volver
            </Button>
            {user ? (
              <UserMenu
                userLogin={user.login}
                logoutMutation={logoutMutation}
              />
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
          <h2 className="text-lg font-semibold">Voz en español</h2>
          <p className="text-sm text-orange-900/70">
            Elige la voz que se usará al escuchar palabras y ejemplos.
          </p>

          {voices.length === 0 ? (
            <p className="text-sm text-orange-900/70" role="status">
              No hay voces en español en este dispositivo. La reproducción puede
              no estar disponible.
            </p>
          ) : (
            <>
              <label
                className="block text-sm font-medium"
                htmlFor="spanish-voice"
              >
                Voz
              </label>
              <div className="flex max-w-md items-center gap-3">
                <select
                  id="spanish-voice"
                  value={selectedVoiceURI}
                  onChange={(event) => {
                    const nextURI = event.target.value
                    setSelectedVoiceURI(nextURI)
                    setPreferredSpanishVoiceURI(nextURI || null)
                  }}
                  className="h-10 min-w-0 flex-1 appearance-none rounded-lg border border-orange-200 bg-white bg-[length:1rem] bg-[position:right_0.75rem_center] bg-no-repeat px-3 pr-10 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239a3412' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  }}
                >
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10"
                  aria-label="Probar voz"
                  disabled={!selectedVoiceURI}
                  onClick={() => {
                    setPreferredSpanishVoiceURI(selectedVoiceURI || null)
                    speakSpanish('Hola, esta es una prueba de voz.')
                  }}
                >
                  <Volume2 className="size-5" aria-hidden />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function UserMenu({
  userLogin,
  logoutMutation,
}: {
  userLogin: string
  logoutMutation: ReturnType<typeof useLogoutMutation>
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initial = userLogin.trim().charAt(0).toLocaleUpperCase() || '?'

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
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-700 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
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
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-orange-50"
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
            className="flex w-full items-center gap-2 border-t border-orange-100 px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
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
      navigate('/login', { replace: true })
    },
  })
}

function SuggestionRow({ item }: { item: SuggestionItem }) {
  const navigate = useNavigate()
  const params = new URLSearchParams({
    spanish: item.spanish,
    russian: item.russian,
  })

  return (
    <li className="border-t border-orange-100 first:border-t-0" role="option">
      <button
        type="button"
        className="w-full px-4 py-3 text-left text-sm hover:bg-orange-50"
        onClick={() => {
          navigate(`/words/new?${params}`)
        }}
      >
        <span className="font-medium">{item.spanish}</span>
        <span className="text-orange-900/50"> — </span>
        <span>{item.russian}</span>
      </button>
    </li>
  )
}

function AddWordPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const spanish = searchParams.get('spanish')?.trim() ?? ''
  const russian = searchParams.get('russian')?.trim() ?? ''
  const hasPair = spanish.length > 0 && russian.length > 0

  const previewQuery = useQuery({
    queryKey: ['words', 'preview', spanish, russian],
    queryFn: ({ signal }) => previewWord({ spanish, russian }, signal),
    enabled: hasPair,
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: createWord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
      navigate('/', { replace: true })
    },
  })

  if (!hasPair) {
    return <Navigate replace to="/" />
  }

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
              Aprender Palabras
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Añadir palabra
            </h1>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Cancelar
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        {previewQuery.isPending && (
          <p className="text-sm text-orange-900/70" role="status">
            Generando la tarjeta…
          </p>
        )}

        {previewQuery.isError && (
          <div role="alert">
            <p className="text-sm text-red-700">
              No se pudo generar la tarjeta. Puedes reintentarlo.
            </p>
            <Button
              className="mt-4"
              onClick={() => void previewQuery.refetch()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {previewQuery.isSuccess && (
          <WordDraftView
            draft={previewQuery.data}
            isSaving={createMutation.isPending}
            saveError={createMutation.error}
            onConfirm={() => createMutation.mutate(previewQuery.data)}
            onCancel={() => navigate('/')}
          />
        )}
      </div>
    </main>
  )
}

function WordDraftView({
  draft,
  isSaving,
  saveError,
  onConfirm,
  onCancel,
}: {
  draft: WordDraft
  isSaving: boolean
  saveError: unknown
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <SpeakButton text={draft.spanish} size="lg" />
          <p className="text-3xl font-bold tracking-tight">{draft.spanish}</p>
        </div>
        <p className="mt-1 text-lg text-orange-900/80">{draft.russian}</p>
      </div>

      {draft.imageUrl && (
        <figure>
          <img
            src={draft.imageUrl}
            alt=""
            className="max-h-80 w-full rounded-2xl object-cover"
          />
          {draft.imagePhotographerName && draft.imagePhotographerUrl && (
            <figcaption className="mt-2 text-xs text-orange-900/60">
              Foto de{' '}
              <a
                href={draft.imagePhotographerUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {draft.imagePhotographerName}
              </a>
              {draft.imagePageUrl && (
                <>
                  {' '}
                  en{' '}
                  <a
                    href={draft.imagePageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Unsplash
                  </a>
                </>
              )}
            </figcaption>
          )}
        </figure>
      )}

      <ReadOnlyField
        label="Traducciones adicionales"
        value={
          draft.additionalTranslations.length > 0
            ? draft.additionalTranslations.join(', ')
            : null
        }
      />
      <ReadOnlyField label="Definición" value={draft.definitionEs} />
      <div>
        <p className="text-sm font-medium text-orange-900/70">Ejemplos</p>
        {draft.examples.length > 0 ? (
          <ul className="mt-1 space-y-2">
            {draft.examples.map((example) => (
              <li key={example} className="flex items-start gap-2">
                <SpeakButton text={example} className="mt-0.5" />
                <p className="text-orange-950">{example}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-orange-900/40">Sin datos</p>
        )}
      </div>
      <ReadOnlyField label="Categoría gramatical" value={draft.partOfSpeech} />
      <ReadOnlyField
        label="Género"
        value={
          draft.gender === 'masculine'
            ? 'masculino'
            : draft.gender === 'feminine'
              ? 'femenino'
              : null
        }
      />
      <ReadOnlyField
        label="Opciones incorrectas (ruso)"
        value={
          draft.wrongRussian.length > 0 ? draft.wrongRussian.join(', ') : null
        }
      />
      <ReadOnlyField
        label="Opciones incorrectas (español)"
        value={
          draft.wrongSpanish.length > 0 ? draft.wrongSpanish.join(', ') : null
        }
      />

      {isConflict(saveError) ? (
        <p role="alert" className="text-sm text-red-700">
          Esta palabra ya existe en la base de datos.
        </p>
      ) : null}

      {saveError && !isConflict(saveError) ? (
        <p role="alert" className="text-sm text-red-700">
          No se pudo guardar la palabra. Inténtalo de nuevo.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="bg-orange-700 hover:bg-orange-800"
          disabled={isSaving}
          onClick={onConfirm}
        >
          {isSaving ? 'Guardando…' : 'Confirmar'}
        </Button>
        <Button variant="outline" disabled={isSaving} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  )
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div>
      <p className="text-sm font-medium text-orange-900/70">{label}</p>
      {value ? (
        <p className="mt-1 text-orange-950">{value}</p>
      ) : (
        <p className="mt-1 text-sm text-orange-900/40">Sin datos</p>
      )}
    </div>
  )
}

function SpeakButton({
  text,
  size = 'sm',
  className = '',
}: {
  text: string
  size?: 'sm' | 'lg'
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label="Escuchar"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg text-orange-700 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 ${
        size === 'lg' ? 'size-10' : 'size-8'
      } ${className}`}
      onClick={() => {
        speakSpanish(text)
      }}
    >
      <Volume2 className={size === 'lg' ? 'size-6' : 'size-4'} aria-hidden />
    </button>
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

function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
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
