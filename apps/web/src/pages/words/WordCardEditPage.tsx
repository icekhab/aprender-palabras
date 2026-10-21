import type { UpdateWordCardInput, UserCardDetail } from '@aprender-palabras/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/shared/api/auth'
import { getWordCard, updateWordCard } from '@/shared/api/words'
import { WordCardForm } from './WordCardForm'

const DICTIONARY_QUERY_KEY = ['words', 'dictionary'] as const

export function WordCardEditPage() {
  const { cardId = '' } = useParams<{ cardId: string }>()
  const navigate = useNavigate()

  const cardQuery = useQuery({
    queryKey: ['words', 'card', cardId],
    queryFn: ({ signal }) => getWordCard(cardId, signal),
    enabled: cardId.length > 0,
    retry: false,
  })

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Editar palabra
            </h1>
          </div>
          <Button variant="outline" onClick={() => navigate(`/words/${cardId}`)}>
            Cancelar
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        {cardQuery.isPending ? (
          <p className="text-sm text-orange-900/70" role="status">
            Cargando la tarjeta…
          </p>
        ) : null}

        {cardQuery.isError ? (
          <div role="alert">
            <p className="text-sm text-red-700">
              {cardQuery.error instanceof ApiError &&
              cardQuery.error.status === 404
                ? 'No se encontró la tarjeta.'
                : 'No se pudo cargar la tarjeta.'}
            </p>
            <Button className="mt-4" onClick={() => void cardQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {cardQuery.isSuccess ? (
          <WordCardEditForm card={cardQuery.data} />
        ) : null}
      </div>
    </main>
  )
}

function WordCardEditForm({ card }: { card: UserCardDetail }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: (input: UpdateWordCardInput) => updateWordCard(card.id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['words', 'card', card.id], updated)
      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['lessons'] })
      await queryClient.invalidateQueries({ queryKey: ['training', 'today'] })
      navigate(`/words/${card.id}`, { replace: true })
    },
  })

  return (
    <WordCardForm
      initial={card}
      spanishEditable={false}
      submitLabel="Guardar"
      submittingLabel="Guardando…"
      isSubmitting={saveMutation.isPending}
      saveError={saveMutation.error}
      onSubmit={(payload) => saveMutation.mutate(payload)}
      onCancel={() => navigate(`/words/${card.id}`)}
    />
  )
}
