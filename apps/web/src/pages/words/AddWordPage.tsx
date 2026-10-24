import type {
  UpdateWordCardInput,
  WordDraft,
} from '@aprender-palabras/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { WordGenerateLoader } from '@/components/word-generate-loader'
import { addNewWordToLesson } from '@/shared/api/lessons'
import { createWord, previewWord } from '@/shared/api/words'
import {
  updatePayloadToWordDraft,
  WordCardForm,
  type WordCardFormInitial,
} from './WordCardForm'

const DICTIONARY_QUERY_KEY = ['words', 'dictionary'] as const

export function AddWordPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const spanish = searchParams.get('spanish')?.trim() ?? ''
  const russian = searchParams.get('russian')?.trim() ?? ''
  const lessonId = searchParams.get('lessonId')?.trim() || null
  const hasPair = spanish.length > 0 && russian.length > 0
  const cancelPath = lessonId ? `/lecciones/${lessonId}` : '/'

  const previewQuery = useQuery({
    queryKey: ['words', 'preview', spanish, russian],
    queryFn: ({ signal }) => previewWord({ spanish, russian }, signal),
    enabled: hasPair,
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: (draft: WordDraft) => {
      if (lessonId) {
        return addNewWordToLesson(lessonId, draft)
      }
      return createWord(draft)
    },
    onSuccess: async () => {
      if (lessonId) {
        await queryClient.invalidateQueries({
          queryKey: ['lessons', 'detail', lessonId],
        })
        await queryClient.invalidateQueries({ queryKey: ['lessons', 'list'] })
        navigate(`/lecciones/${lessonId}`, { replace: true })
        return
      }

      await queryClient.invalidateQueries({ queryKey: DICTIONARY_QUERY_KEY })
      navigate('/', { replace: true })
    },
  })

  if (!hasPair) {
    return <Navigate replace to={cancelPath} />
  }

  const emptyInitial = emptyFormInitial(spanish, russian)
  const formInitial: WordCardFormInitial | null = previewQuery.isSuccess
    ? previewQuery.data
    : previewQuery.isError
      ? emptyInitial
      : null

  return (
    <main className="flex min-h-svh flex-col bg-orange-50 text-orange-950">
      <header className="shrink-0 border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              {lessonId ? 'Añadir a la lección' : 'Añadir palabra'}
            </h1>
          </div>
          <Button variant="outline" onClick={() => navigate(cancelPath)}>
            Cancelar
          </Button>
        </div>
      </header>

      {previewQuery.isPending ? (
        <div className="grid flex-1 place-items-center px-5 py-10">
          <WordGenerateLoader />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-8">
          {previewQuery.isError ? (
            <div className="mb-6" role="status">
              <p className="text-sm text-orange-900/70">
                No se pudo generar automáticamente. Puedes completar la tarjeta
                a mano o reintentar.
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

          {formInitial ? (
            <WordCardForm
              key={`${formInitial.spanish}|${formInitial.russian}|${previewQuery.isSuccess ? 'ai' : 'manual'}`}
              initial={formInitial}
              spanishEditable
              submitLabel="Confirmar"
              submittingLabel="Guardando…"
              isSubmitting={createMutation.isPending}
              saveError={createMutation.error}
              conflictMessage="Esta palabra ya existe en la base de datos."
              onSubmit={(payload: UpdateWordCardInput) => {
                createMutation.mutate(updatePayloadToWordDraft(payload))
              }}
              onCancel={() => navigate(cancelPath)}
            />
          ) : null}
        </div>
      )}
    </main>
  )
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
