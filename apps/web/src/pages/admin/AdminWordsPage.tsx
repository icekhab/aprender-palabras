import type {
  AdminWordsSortBy,
  SuggestionItem,
} from '@aprender-palabras/contracts'
import { RUSSIAN_MAX_CHARS } from '@aprender-palabras/contracts'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { listAdminWords } from '@/shared/api/admin-words'
import { ApiError } from '@/shared/api/auth'
import { getSuggestions } from '@/shared/api/suggestions'
import { SuggestionsErrorMessage } from '@/shared/suggestions-error'
import { getSuggestionsQueryError } from '@/shared/suggestions-query'

const ADMIN_WORDS_QUERY_KEY = ['admin', 'words'] as const
const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatAdminDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function AdminWordsPage({
  userMenu,
}: {
  userMenu: ReactNode
}) {
  const navigate = useNavigate()
  const [suggestionInput, setSuggestionInput] = useState('')
  const [debouncedSuggestion, setDebouncedSuggestion] = useState('')
  const [suggestionFocused, setSuggestionFocused] = useState(false)
  const [filterInput, setFilterInput] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [sortBy, setSortBy] = useState<AdminWordsSortBy>('updatedAt')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSuggestion(suggestionInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [suggestionInput])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFilter(filterInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [filterInput])

  const suggestionsValidationError =
    getSuggestionsQueryError(debouncedSuggestion)

  const suggestionsQuery = useQuery({
    queryKey: ['admin', 'suggestions', debouncedSuggestion],
    queryFn: ({ signal }) => getSuggestions(debouncedSuggestion, signal),
    enabled:
      debouncedSuggestion.length >= MIN_QUERY_LENGTH &&
      !suggestionsValidationError,
    retry: false,
  })

  const showSuggestionsPanel =
    suggestionFocused && debouncedSuggestion.length >= MIN_QUERY_LENGTH

  const wordsQuery = useInfiniteQuery({
    queryKey: [...ADMIN_WORDS_QUERY_KEY, sortBy, debouncedFilter],
    queryFn: ({ pageParam, signal }) =>
      listAdminWords(
        {
          limit: PAGE_SIZE,
          offset: pageParam,
          sortBy,
          q: debouncedFilter || undefined,
        },
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

  const items = wordsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const totalCount = wordsQuery.data?.pages[0]?.totalCount ?? 0

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Todas las palabras
            </h1>
            <p className="mt-1 text-sm text-orange-900/70">
              {totalCount === 1
                ? '1 palabra'
                : `${totalCount} palabras`}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="relative w-full sm:w-80"
              onFocus={() => {
                setSuggestionFocused(true)
              }}
              onBlur={(event) => {
                const root = event.currentTarget
                const next = event.relatedTarget as Node | null
                window.setTimeout(() => {
                  if (next && root.contains(next)) {
                    return
                  }
                  if (root.contains(document.activeElement)) {
                    return
                  }
                  setSuggestionFocused(false)
                }, 0)
              }}
            >
              <label className="sr-only" htmlFor="admin-suggestion-search">
                Buscar para añadir al catálogo
              </label>
              <input
                id="admin-suggestion-search"
                value={suggestionInput}
                onChange={(event) => setSuggestionInput(event.target.value)}
                placeholder="Buscar para añadir…"
                autoComplete="off"
                maxLength={RUSSIAN_MAX_CHARS}
                className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
              />

              {showSuggestionsPanel ? (
                <div
                  className="absolute top-full right-0 left-0 z-10 mt-2 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm"
                  role="listbox"
                  aria-label="Sugerencias"
                >
                  {suggestionsValidationError ? (
                    <SuggestionsErrorMessage message={suggestionsValidationError} />
                  ) : null}

                  {!suggestionsValidationError && suggestionsQuery.isFetching ? (
                    <p
                      className="px-4 py-3 text-sm text-orange-900/70"
                      role="status"
                    >
                      Buscando…
                    </p>
                  ) : null}

                  {!suggestionsValidationError && suggestionsQuery.isError ? (
                    <SuggestionsErrorMessage error={suggestionsQuery.error} />
                  ) : null}

                  {!suggestionsValidationError &&
                  suggestionsQuery.isSuccess &&
                  suggestionsQuery.data.suggestions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-orange-900/70">
                      No hay sugerencias.
                    </p>
                  ) : null}

                  {!suggestionsValidationError &&
                  suggestionsQuery.isSuccess &&
                  suggestionsQuery.data.suggestions.length > 0 ? (
                    <ul>
                      {suggestionsQuery.data.suggestions.map((item) => (
                        <AdminSuggestionRow
                          key={`${item.spanish}|${item.russian}`}
                          item={item}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
            {userMenu}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="admin-catalog-filter">
            Filtrar catálogo
          </label>
          <input
            id="admin-catalog-filter"
            value={filterInput}
            onChange={(event) => setFilterInput(event.target.value)}
            placeholder="Filtrar catálogo…"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200 sm:flex-1"
          />
          <div
            className="flex shrink-0 overflow-hidden rounded-lg border border-orange-200 bg-white"
            role="group"
            aria-label="Ordenar por"
          >
            <SortButton
              active={sortBy === 'updatedAt'}
              onClick={() => setSortBy('updatedAt')}
            >
              Actualización
            </SortButton>
            <SortButton
              active={sortBy === 'createdAt'}
              onClick={() => setSortBy('createdAt')}
            >
              Alta
            </SortButton>
          </div>
        </div>

        {wordsQuery.isPending ? (
          <p className="text-sm text-orange-900/70" role="status">
            Cargando palabras…
          </p>
        ) : null}

        {wordsQuery.isError ? (
          <div role="alert">
            <p className="text-sm text-red-700">
              {wordsQuery.error instanceof ApiError &&
              wordsQuery.error.status === 403
                ? 'No tienes permiso para ver el catálogo.'
                : 'No se pudieron cargar las palabras.'}
            </p>
            <Button className="mt-4" onClick={() => void wordsQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {wordsQuery.isSuccess && items.length === 0 ? (
          <p className="text-sm text-orange-900/70" role="status">
            {debouncedFilter
              ? 'No hay coincidencias.'
              : 'Todavía no hay palabras.'}
          </p>
        ) : null}

        {items.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
            {items.map((word) => (
              <li
                key={word.id}
                className="border-t border-orange-100 first:border-t-0"
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start justify-between gap-4 px-4 py-3 text-left hover:bg-orange-50"
                  onClick={() => navigate(`/admin/words/${word.id}/edit`)}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{word.spanish}</span>
                    <span className="mt-0.5 block text-sm text-orange-900/70">
                      {word.russian}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-orange-900/60">
                    <span className="block">
                      Act. {formatAdminDate(word.updatedAt)}
                    </span>
                    <span className="mt-0.5 block">
                      Alta {formatAdminDate(word.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {wordsQuery.hasNextPage ? (
          <Button
            variant="outline"
            disabled={wordsQuery.isFetchingNextPage}
            onClick={() => void wordsQuery.fetchNextPage()}
          >
            {wordsQuery.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        ) : null}
      </div>
    </main>
  )
}

function AdminSuggestionRow({ item }: { item: SuggestionItem }) {
  const navigate = useNavigate()
  const params = new URLSearchParams({
    spanish: item.spanish,
    russian: item.russian,
  })

  const text = (
    <span className="min-w-0 flex-1 text-base">
      <span className="font-medium">{item.spanish}</span>
      <span className="text-orange-900/50"> — </span>
      <span>{item.russian}</span>
    </span>
  )

  if (item.wordId !== null) {
    return (
      <li className="border-t border-orange-100 first:border-t-0" role="option">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-orange-50"
          onMouseDown={keepSearchFocus}
          onPointerDown={keepSearchFocus}
          onClick={() => {
            navigate(`/admin/words/${item.wordId}/edit`)
          }}
        >
          {text}
          <span className="shrink-0 text-xs text-orange-900/60">En catálogo</span>
        </button>
      </li>
    )
  }

  return (
    <li className="border-t border-orange-100 first:border-t-0" role="option">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-orange-50"
        onMouseDown={keepSearchFocus}
        onPointerDown={keepSearchFocus}
        onClick={() => {
          navigate(`/admin/words/new?${params}`)
        }}
      >
        {text}
      </button>
    </li>
  )
}

function keepSearchFocus(
  event: ReactMouseEvent | ReactPointerEvent,
): void {
  event.preventDefault()
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={
        active
          ? 'cursor-pointer bg-orange-700 px-3 py-2 text-sm font-medium text-white'
          : 'cursor-pointer px-3 py-2 text-sm font-medium text-orange-900/80 hover:bg-orange-50'
      }
      onClick={onClick}
    >
      {children}
    </button>
  )
}
