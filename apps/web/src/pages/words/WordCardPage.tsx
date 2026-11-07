import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UserCardDetail } from '@aprender-palabras/contracts'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { WordCardFields } from '@/components/word-card-fields'
import { WordGenerateLoader } from '@/components/word-generate-loader'
import { ApiError } from '@/shared/api/auth'
import { readReturnTo } from '@/shared/return-to'
import {
  deleteWordCard,
  getWordCard,
  resetWordCardProgress,
} from '@/shared/api/words'

const DICTIONARY_QUERY_KEY = ['words', 'dictionary'] as const

export function WordCardPage() {
  const { cardId = '' } = useParams<{ cardId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = readReturnTo(searchParams)
  const queryClient = useQueryClient()

  const cardQuery = useQuery({
    queryKey: ['words', 'card', cardId],
    queryFn: ({ signal }) => getWordCard(cardId, signal),
    enabled: cardId.length > 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.generationStatus === 'generating' ? 5_000 : false,
  })

  const sawGeneratingRef = useRef(false)
  useEffect(() => {
    const status = cardQuery.data?.generationStatus
    if (status === 'generating') {
      sawGeneratingRef.current = true
      return
    }

    if (
      sawGeneratingRef.current &&
      (status === 'ready' || status === 'failed')
    ) {
      sawGeneratingRef.current = false
      void queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
    }
  }, [cardQuery.data?.generationStatus, queryClient])

  const isCenteredState =
    cardQuery.isPending ||
    cardQuery.isError ||
    (cardQuery.isSuccess &&
      (cardQuery.data.generationStatus === 'generating' ||
        cardQuery.data.generationStatus === 'failed'))

  return (
    <main className="flex min-h-svh flex-col bg-orange-50 text-orange-950">
      <header className="shrink-0 border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">Palabra</h1>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (returnTo) {
                void navigate(returnTo)
                return
              }
              void navigate(-1)
            }}
          >
            Atrás
          </Button>
        </div>
      </header>

      {isCenteredState ? (
        <div className="grid flex-1 place-items-center px-5 py-10">
          {cardQuery.isPending ? (
            <p className="text-sm text-orange-900/70" role="status">
              Cargando la tarjeta…
            </p>
          ) : null}

          {cardQuery.isError ? (
            <div className="max-w-sm text-center" role="alert">
              <p className="text-sm text-red-700">
                {cardQuery.error instanceof ApiError &&
                cardQuery.error.status === 404
                  ? 'No se encontró la tarjeta.'
                  : 'No se pudo cargar la tarjeta.'}
              </p>
              <Button
                className="mt-4"
                onClick={() => void cardQuery.refetch()}
              >
                Reintentar
              </Button>
            </div>
          ) : null}

          {cardQuery.isSuccess &&
          cardQuery.data.generationStatus === 'generating' ? (
            <WordGenerateLoader />
          ) : null}

          {cardQuery.isSuccess &&
          cardQuery.data.generationStatus === 'failed' ? (
            <GenerationFailedState
              card={cardQuery.data}
              onDeleted={() => {
                void queryClient.invalidateQueries({
                  queryKey: DICTIONARY_QUERY_KEY,
                })
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-8">
          {cardQuery.isSuccess &&
          cardQuery.data.generationStatus === 'ready' ? (
            <WordCardContent card={cardQuery.data} />
          ) : null}
        </div>
      )}
    </main>
  )
}

function GenerationFailedState({
  card,
  onDeleted,
}: {
  card: UserCardDetail
  onDeleted: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => deleteWordCard(card.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['lessons'] })
      await queryClient.invalidateQueries({ queryKey: ['training', 'today'] })
      queryClient.removeQueries({ queryKey: ['words', 'card', card.id] })
      onDeleted()
      navigate('/', { replace: true })
    },
  })

  return (
    <div className="max-w-md space-y-4 text-center" role="alert">
      <h2 className="text-lg font-semibold tracking-tight">
        No se pudo generar la tarjeta
      </h2>
      <p className="text-sm text-orange-900/70">
        «{card.spanish}» — {card.russian}. Puedes eliminarla del diccionario e
        intentarlo más tarde.
      </p>
      {deleteMutation.isError ? (
        <p className="text-sm text-red-700">
          No se pudo eliminar. Inténtalo de nuevo.
        </p>
      ) : null}
      <Button
        className="bg-red-700 hover:bg-red-800"
        disabled={deleteMutation.isPending}
        onClick={() => deleteMutation.mutate()}
      >
        {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar del diccionario'}
      </Button>
    </div>
  )
}

function WordCardContent({ card }: { card: UserCardDetail }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<'reset' | 'delete' | null>(
    null,
  )

  const resetMutation = useMutation({
    mutationFn: () => resetWordCardProgress(card.id),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['words', 'card', card.id], updated)
      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['lessons'] })
      await queryClient.invalidateQueries({ queryKey: ['training', 'today'] })
      setConfirmAction(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteWordCard(card.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['lessons'] })
      await queryClient.invalidateQueries({ queryKey: ['training', 'today'] })
      queryClient.removeQueries({ queryKey: ['words', 'card', card.id] })
      navigate('/', { replace: true })
    },
  })

  const actionPending = resetMutation.isPending || deleteMutation.isPending

  return (
    <div className="space-y-6">
      <WordCardFields
        draft={card}
        wordId={card.wordId}
        progress={card.progress}
        onProgressDoubleClick={
          actionPending ? undefined : () => setConfirmAction('reset')
        }
        onEdit={
          card.canEdit
            ? () => navigate(`/words/${card.id}/edit`)
            : undefined
        }
      />

      <div className="border-t border-orange-100 pt-6">
        <Button
          className="bg-red-700 hover:bg-red-800"
          disabled={actionPending}
          onClick={() => setConfirmAction('delete')}
        >
          Eliminar del diccionario
        </Button>
      </div>

      {resetMutation.isError || deleteMutation.isError ? (
        <p role="alert" className="text-sm text-red-700">
          No se pudo completar la acción. Inténtalo de nuevo.
        </p>
      ) : null}

      {confirmAction ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={
            confirmAction === 'reset'
              ? 'Reiniciar progreso'
              : 'Eliminar del diccionario'
          }
        >
          <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-bold">
              {confirmAction === 'reset'
                ? 'Reiniciar progreso'
                : 'Eliminar del diccionario'}
            </h2>
            <p className="mt-3 text-sm text-orange-900/80">
              {confirmAction === 'reset'
                ? `¿Reiniciar el progreso de «${card.spanish}»? Se borrarán también los datos de entrenamiento, como si la palabra se acabara de añadir.`
                : `¿Eliminar «${card.spanish}» del diccionario? Se quitará también de tus lecciones. Podrás añadirla de nuevo más tarde.`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={actionPending}
                onClick={() => setConfirmAction(null)}
              >
                Cancelar
              </Button>
              {confirmAction === 'reset' ? (
                <Button
                  className="bg-orange-700 hover:bg-orange-800"
                  disabled={actionPending}
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending ? 'Reiniciando…' : 'Reiniciar'}
                </Button>
              ) : (
                <Button
                  className="bg-red-700 hover:bg-red-800"
                  disabled={actionPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
