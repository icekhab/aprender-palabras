import type {
  AdminWordDetail,
  UpdateWordCardInput,
} from '@aprender-palabras/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { getAdminWord, updateAdminWord } from '@/shared/api/admin-words'
import { ApiError } from '@/shared/api/auth'
import { WordCardForm } from '../words/WordCardForm'

const ADMIN_WORDS_QUERY_KEY = ['admin', 'words'] as const

export function AdminWordEditPage() {
  const { wordId = '' } = useParams<{ wordId: string }>()
  const navigate = useNavigate()

  const wordQuery = useQuery({
    queryKey: ['admin', 'words', wordId],
    queryFn: ({ signal }) => getAdminWord(wordId, signal),
    enabled: wordId.length > 0,
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
          <Button
            variant="outline"
            onClick={() => navigate('/admin/words')}
          >
            Cancelar
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        {wordQuery.isPending ? (
          <p className="text-sm text-orange-900/70" role="status">
            Cargando la palabra…
          </p>
        ) : null}

        {wordQuery.isError ? (
          <div role="alert">
            <p className="text-sm text-red-700">
              {wordQuery.error instanceof ApiError &&
              wordQuery.error.status === 404
                ? 'No se encontró la palabra.'
                : wordQuery.error instanceof ApiError &&
                    wordQuery.error.status === 403
                  ? 'No tienes permiso para editar esta palabra.'
                  : 'No se pudo cargar la palabra.'}
            </p>
            <Button className="mt-4" onClick={() => void wordQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {wordQuery.isSuccess ? (
          <AdminWordEditForm word={wordQuery.data} />
        ) : null}
      </div>
    </main>
  )
}

function AdminWordEditForm({ word }: { word: AdminWordDetail }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: (input: UpdateWordCardInput) =>
      updateAdminWord(word.id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['admin', 'words', word.id], updated)
      await queryClient.invalidateQueries({ queryKey: ADMIN_WORDS_QUERY_KEY })
      navigate('/admin/words', { replace: true })
    },
  })

  return (
    <WordCardForm
      initial={word}
      wordId={word.id}
      spanishEditable={false}
      submitLabel="Guardar"
      submittingLabel="Guardando…"
      isSubmitting={saveMutation.isPending}
      saveError={saveMutation.error}
      onSubmit={(payload) => saveMutation.mutate(payload)}
      onCancel={() => navigate('/admin/words')}
    />
  )
}
