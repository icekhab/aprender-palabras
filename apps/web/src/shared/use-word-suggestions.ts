import type { SuggestionItem } from '@aprender-palabras/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { ApiError } from './api/auth'
import { getAiSuggestions, getDbSuggestions } from './api/suggestions'
import { mergeSuggestions } from './merge-suggestions'
import {
  getSuggestionsFetchErrorCopy,
  getSuggestionsQueryError,
} from './suggestions-query'
import { useToast } from './toast'

const MIN_QUERY_LENGTH = 2

export const DB_ONLY_QUOTA_HINT =
  'Cuota de IA agotada. Solo palabras de la base de datos.'

export type WordSuggestionsState = {
  validationError: string | null
  suggestions: SuggestionItem[]
  isInitialLoading: boolean
  isSearchingAi: boolean
  dbError: unknown
  /** False while live input has not caught up to debounced query (or vice versa). */
  isInputSynced: boolean
  /** True when AI suggestions are skipped due to daily quota. */
  showDbOnlyQuotaHint: boolean
}

export function useWordSuggestions(
  debouncedQuery: string,
  options: {
    enabled: boolean
    canUseAiSuggestions: boolean
    queryKeyPrefix?: readonly unknown[]
    /** Live (non-debounced) input; used to hide stale lists and clear DB cache. */
    liveQuery?: string
  },
): WordSuggestionsState {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const toastedAiErrors = useRef(new Set<string>())
  const queryKeyPrefix = options.queryKeyPrefix ?? ['suggestions']
  const queryKeyPrefixId = queryKeyPrefix.join('\0')
  const liveTrimmed = (options.liveQuery ?? debouncedQuery).trim()
  const isInputSynced = liveTrimmed === debouncedQuery

  const validationError = getSuggestionsQueryError(debouncedQuery)
  const queryReady =
    options.enabled &&
    debouncedQuery.length >= MIN_QUERY_LENGTH &&
    !validationError

  useEffect(() => {
    if (liveTrimmed.length >= MIN_QUERY_LENGTH) {
      return
    }
    const prefix = queryKeyPrefixId.split('\0')
    void queryClient.removeQueries({
      queryKey: [...prefix, 'db'],
    })
  }, [liveTrimmed, queryClient, queryKeyPrefixId])

  const dbQuery = useQuery({
    queryKey: [...queryKeyPrefix, 'db', debouncedQuery],
    queryFn: ({ signal }) => getDbSuggestions(debouncedQuery, signal),
    enabled: queryReady,
    retry: false,
  })

  const aiEnabled = queryReady && options.canUseAiSuggestions

  const aiQuery = useQuery({
    queryKey: [...queryKeyPrefix, 'ai', debouncedQuery],
    queryFn: ({ signal }) => getAiSuggestions(debouncedQuery, signal),
    enabled: aiEnabled,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    toastedAiErrors.current.clear()
  }, [debouncedQuery])

  useEffect(() => {
    if (!aiQuery.isError || !aiQuery.error) {
      return
    }

    const errorKey = `${debouncedQuery}:${String(aiQuery.error)}`
    if (toastedAiErrors.current.has(errorKey)) {
      return
    }
    toastedAiErrors.current.add(errorKey)

    const copy = getSuggestionsFetchErrorCopy(aiQuery.error)
    showToast(copy)

    if (
      aiQuery.error instanceof ApiError &&
      aiQuery.error.status === 429
    ) {
      queryClient.setQueryData(
        ['auth', 'me'],
        (current: { canUseAiSuggestions?: boolean } | undefined) => {
          if (!current) {
            return current
          }
          return { ...current, canUseAiSuggestions: false }
        },
      )
    }
  }, [
    aiQuery.error,
    aiQuery.isError,
    debouncedQuery,
    queryClient,
    showToast,
  ])

  const dbSuggestions = dbQuery.data?.suggestions ?? []
  const aiSuggestions = aiQuery.data?.suggestions ?? []
  const aiReady = aiQuery.isSuccess && !aiQuery.isFetching

  const suggestions =
    !isInputSynced || !dbQuery.isSuccess
      ? []
      : aiReady
        ? mergeSuggestions(dbSuggestions, aiSuggestions)
        : dbSuggestions

  const isSearchingAi =
    isInputSynced &&
    aiEnabled &&
    dbQuery.isSuccess &&
    (aiQuery.isPending || aiQuery.isFetching) &&
    !aiQuery.isError

  const isInitialLoading =
    (liveTrimmed.length >= MIN_QUERY_LENGTH && !isInputSynced) ||
    (isInputSynced &&
      queryReady &&
      !dbQuery.isSuccess &&
      (dbQuery.isPending || dbQuery.isFetching))

  const showDbOnlyQuotaHint =
    isInputSynced &&
    !options.canUseAiSuggestions &&
    dbQuery.isSuccess &&
    !isSearchingAi

  return {
    validationError: isInputSynced ? validationError : null,
    suggestions,
    isInitialLoading,
    isSearchingAi,
    dbError: isInputSynced && dbQuery.isError ? dbQuery.error : null,
    isInputSynced,
    showDbOnlyQuotaHint,
  }
}

export { MIN_QUERY_LENGTH }
