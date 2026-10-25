import type {
  UpdateWordCardInput,
  WordDraft,
  WordPairInput,
} from '@aprender-palabras/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { WordGenerateLoader } from '@/components/word-generate-loader'
import {
  createAdminWord,
  type AdminConflictError,
} from '@/shared/api/admin-words'
import { ApiError } from '@/shared/api/auth'
import { previewWord } from '@/shared/api/words'
import {
  updatePayloadToWordDraft,
  WordCardForm,
  type WordCardFormInitial,
} from '../words/WordCardForm'

const ADMIN_WORDS_QUERY_KEY = ['admin', 'words'] as const

export function AdminWordNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const spanish = searchParams.get('spanish')?.trim() ?? ''
  const russian = searchParams.get('russian')?.trim() ?? ''
  const hasPair = spanish.length > 0 && russian.length > 0

  if (!hasPair) {
    return <Navigate replace to="/admin/words" />
  }

  return (
    <main className="flex min-h-svh flex-col bg-orange-50 text-orange-950">
      <header className="shrink-0 border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Añadir al catálogo
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

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-8">
        <AdminWordGenerateForm
          pair={{ spanish, russian }}
          onCancel={() => navigate('/admin/words')}
        />
      </div>
    </main>
  )
}

function AdminWordGenerateForm({
  pair,
  onCancel,
}: {
  pair: WordPairInput
  onCancel: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const previewQuery = useQuery({
    queryKey: ['admin', 'words', 'preview', pair.spanish, pair.russian],
    queryFn: ({ signal }) => previewWord(pair, signal),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: (draft: WordDraft) => createAdminWord(draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_WORDS_QUERY_KEY })
      navigate('/admin/words', { replace: true })
    },
  })

  const emptyInitial = emptyFormInitial(pair.spanish, pair.russian)
  const formInitial: WordCardFormInitial | null = previewQuery.isSuccess
    ? previewQuery.data
    : previewQuery.isError
      ? emptyInitial
      : null

  const conflictWordId = getConflictWordId(createMutation.error)

  if (previewQuery.isPending) {
    return (
      <div className="grid place-items-center py-16">
        <WordGenerateLoader />
      </div>
    )
  }

  return (
    <div>
      <p className="mb-4 text-sm text-orange-900/70">
        Se guardará en el catálogo global, no en tu diccionario.
      </p>

      {previewQuery.isError ? (
        <div className="mb-6" role="status">
          <p className="text-sm text-orange-900/70">
            No se pudo generar automáticamente. Puedes completar la tarjeta a
            mano o reintentar.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void previewQuery.refetch()}
          >
            Reintentar generación
          </Button>
        </div>
      ) : null}

      {createMutation.isError ? (
        <div className="mb-6" role="alert">
          {conflictWordId ? (
            <>
              <p className="text-sm text-red-700">
                Esta pareja ya existe en el catálogo.
              </p>
              <Button
                className="mt-3"
                onClick={() =>
                  navigate(`/admin/words/${conflictWordId}/edit`, {
                    replace: true,
                  })
                }
              >
                Abrir existente
              </Button>
            </>
          ) : (
            <p className="text-sm text-red-700">
              No se pudo guardar la palabra. Inténtalo de nuevo.
            </p>
          )}
        </div>
      ) : null}

      {formInitial ? (
        <WordCardForm
          key={`${formInitial.spanish}|${formInitial.russian}|${previewQuery.isSuccess ? 'ai' : 'manual'}`}
          initial={formInitial}
          spanishEditable
          submitLabel="Guardar en catálogo"
          submittingLabel="Guardando…"
          isSubmitting={createMutation.isPending}
          saveError={conflictWordId ? null : createMutation.error}
          conflictMessage="Esta palabra ya existe en el catálogo."
          onSubmit={(payload: UpdateWordCardInput) => {
            createMutation.mutate(updatePayloadToWordDraft(payload))
          }}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  )
}

function getConflictWordId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null
  }

  const conflict = error as AdminConflictError
  return typeof conflict.wordId === 'string' ? conflict.wordId : null
}

function emptyFormInitial(
  spanish: string,
  russian: string,
): WordCardFormInitial {
  return {
    spanish,
    russian,
    definitionEs: null,
    examples: [],
    partOfSpeech: null,
    gender: null,
    wrongRussian: [],
    wrongSpanish: [],
    imageUrl: null,
    imagePhotographerName: null,
    imagePhotographerUrl: null,
    imagePageUrl: null,
    imageProvider: null,
    imageDownloadLocation: null,
  }
}
