import type {
  UpdateWordCardInput,
  WordDraft,
} from '@aprender-palabras/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { WordGenerateLoader } from '@/components/word-generate-loader'
import {
  createAdminWord,
  findAdminWordByPair,
  type AdminConflictError,
} from '@/shared/api/admin-words'
import { ApiError } from '@/shared/api/auth'
import {
  addNewWordToCollection,
  addWordToCollection,
} from '@/shared/api/collections'
import { previewWord, regenerateWordImage } from '@/shared/api/words'
import { useToast } from '@/shared/toast'
import {
  COLLECTIONS_QUERY_KEY,
  collectionQueryKey,
} from '../collections/query-keys'
import {
  updatePayloadToWordDraft,
  WordCardForm,
} from '../words/WordCardForm'
import {
  csvRowHasCompleteContent,
  csvRowToEmptyDraft,
  mergeCsvRowOverDraft,
  type CsvWordImportRow,
} from './csv-word-import'
import {
  clearCsvWordImportSession,
  importReturnPath,
  importStepKey,
  readCsvWordImportSession,
  runImportStepOnce,
  saveCsvWordImportSession,
  type CsvWordImportSession,
} from './csv-word-import-session'

const ADMIN_WORDS_QUERY_KEY = ['admin', 'words'] as const

export function AdminWordsImportWizardPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<CsvWordImportSession | null>(() =>
    readCsvWordImportSession(),
  )

  if (!session || session.rows.length === 0) {
    return <Navigate replace to="/admin/words/import" />
  }

  if (session.index >= session.rows.length) {
    clearCsvWordImportSession()
    return <Navigate replace to={importReturnPath(session.target)} />
  }

  const row = session.rows[session.index]

  return (
    <ImportWizardStep
      key={`${session.index}|${row.spanish}|${row.russian}`}
      session={session}
      row={row}
      onAdvance={(next) => {
        if (next.index >= next.rows.length) {
          clearCsvWordImportSession()
          navigate(importReturnPath(next.target), { replace: true })
          return
        }

        saveCsvWordImportSession(next)
        setSession(next)
      }}
      onCancel={() => {
        clearCsvWordImportSession()
        navigate(importReturnPath(session.target), { replace: true })
      }}
    />
  )
}

function ImportWizardStep({
  session,
  row,
  onAdvance,
  onCancel,
}: {
  session: CsvWordImportSession
  row: CsvWordImportRow
  onAdvance: (session: CsvWordImportSession) => void
  onCancel: () => void
}) {
  const progressLabel = `${session.index + 1} / ${session.rows.length}`

  const pairLookupQuery = useQuery({
    queryKey: ['admin', 'words', 'by-pair', row.spanish, row.russian],
    queryFn: async ({ signal }) => {
      try {
        return await findAdminWordByPair(
          { spanish: row.spanish, russian: row.russian },
          signal,
        )
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }
    },
    retry: false,
  })

  if (pairLookupQuery.isPending) {
    return (
      <WizardShell progressLabel={progressLabel} onCancel={onCancel}>
        <div className="grid flex-1 place-items-center px-5 py-10">
          <WordGenerateLoader />
        </div>
      </WizardShell>
    )
  }

  if (pairLookupQuery.isError) {
    return (
      <WizardShell progressLabel={progressLabel} onCancel={onCancel}>
        <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-6 sm:px-8">
          <p className="text-sm text-red-700" role="alert">
            No se pudo comprobar si la palabra ya existe.
          </p>
          <Button onClick={() => void pairLookupQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      </WizardShell>
    )
  }

  const existingWordId = pairLookupQuery.data?.wordId ?? null

  if (existingWordId) {
    if (session.target.kind === 'catalog') {
      return (
        <WizardShell progressLabel={progressLabel} onCancel={onCancel}>
          <AutoSkipExisting
            label={`${row.spanish} — ${row.russian}`}
            session={session}
            onAdvance={onAdvance}
          />
        </WizardShell>
      )
    }

    return (
      <WizardShell progressLabel={progressLabel} onCancel={onCancel}>
        <AutoLinkExisting
          wordId={existingWordId}
          label={row.spanish}
          collectionId={session.target.collectionId}
          session={session}
          onAdvance={onAdvance}
        />
      </WizardShell>
    )
  }

  return (
    <NewWordImportForm
      session={session}
      row={row}
      progressLabel={progressLabel}
      onAdvance={onAdvance}
      onCancel={onCancel}
    />
  )
}

function AutoSkipExisting({
  label,
  session,
  onAdvance,
}: {
  label: string
  session: CsvWordImportSession
  onAdvance: (session: CsvWordImportSession) => void
}) {
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false
    const stepKey = importStepKey(session)
    const next = nextSession(session)

    void runImportStepOnce(stepKey, async () => {
      // No API — catalog duplicate skip.
    }).then(() => {
      if (cancelled) {
        return
      }
      showToast(`Omitida (ya en catálogo): ${label}`)
      onAdvance(next)
    })

    return () => {
      cancelled = true
    }
  }, [label, onAdvance, session, showToast])

  return (
    <div className="grid flex-1 place-items-center px-5 py-10">
      <WordGenerateLoader />
    </div>
  )
}

function AutoLinkExisting({
  wordId,
  label,
  collectionId,
  session,
  onAdvance,
}: {
  wordId: string
  label: string
  collectionId: string
  session: CsvWordImportSession
  onAdvance: (session: CsvWordImportSession) => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [linkError, setLinkError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    const stepKey =
      retryNonce === 0
        ? importStepKey(session)
        : `${importStepKey(session)}|retry:${retryNonce}`
    const next = nextSession(session)

    void runImportStepOnce(stepKey, async () => {
      try {
        await addWordToCollection(collectionId, wordId)
      } catch (error) {
        // 409 = already linked (incl. Strict Mode double POST). Treat as OK.
        if (!(error instanceof ApiError && error.status === 409)) {
          throw error
        }
      }

      await queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
      await queryClient.invalidateQueries({
        queryKey: collectionQueryKey(collectionId),
      })
    })
      .then(() => {
        if (cancelled) {
          return
        }
        showToast(`Añadida a la colección: ${label}`)
        onAdvance(next)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setLinkError(true)
      })

    return () => {
      cancelled = true
    }
  }, [
    collectionId,
    label,
    onAdvance,
    queryClient,
    retryNonce,
    session,
    showToast,
    wordId,
  ])

  return (
    <div className="grid flex-1 place-items-center px-5 py-10">
      {linkError ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-red-700" role="alert">
            No se pudo enlazar la palabra existente.
          </p>
          <Button
            onClick={() => {
              setLinkError(false)
              setRetryNonce((value) => value + 1)
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <WordGenerateLoader />
      )}
    </div>
  )
}

function NewWordImportForm({
  session,
  row,
  progressLabel,
  onAdvance,
  onCancel,
}: {
  session: CsvWordImportSession
  row: CsvWordImportRow
  progressLabel: string
  onAdvance: (session: CsvWordImportSession) => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const contentComplete = csvRowHasCompleteContent(row)

  const previewQuery = useQuery({
    queryKey: ['admin', 'words', 'import-preview', row.spanish, row.russian],
    queryFn: ({ signal }) =>
      previewWord({ spanish: row.spanish, russian: row.russian }, signal),
    enabled: !contentComplete,
    retry: false,
  })

  const imageQuery = useQuery({
    queryKey: [
      'admin',
      'words',
      'import-image',
      row.spanish,
      row.russian,
      row.unsplashQuery,
    ],
    queryFn: ({ signal }) =>
      regenerateWordImage(
        {
          spanish: row.spanish,
          russian: row.russian,
          ...(row.unsplashQuery ? { unsplashQuery: row.unsplashQuery } : {}),
        },
        signal,
      ),
    enabled: contentComplete,
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: async (payload: WordDraft) => {
      if (session.target.kind === 'collection') {
        await addNewWordToCollection(session.target.collectionId, payload)
        return
      }

      await createAdminWord(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_WORDS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
      if (session.target.kind === 'collection') {
        await queryClient.invalidateQueries({
          queryKey: collectionQueryKey(session.target.collectionId),
        })
      }
      onAdvance(nextSession(session))
    },
  })

  const loading = contentComplete
    ? imageQuery.isPending
    : previewQuery.isPending

  if (loading) {
    return (
      <WizardShell progressLabel={progressLabel} onCancel={onCancel}>
        <div className="grid flex-1 place-items-center px-5 py-10">
          <WordGenerateLoader />
        </div>
      </WizardShell>
    )
  }

  const draft: WordDraft = (() => {
    if (contentComplete) {
      const base = csvRowToEmptyDraft(row)
      if (!imageQuery.isSuccess) {
        return base
      }
      return {
        ...base,
        imageUrl: imageQuery.data.imageUrl,
        imagePhotographerName: imageQuery.data.imagePhotographerName,
        imagePhotographerUrl: imageQuery.data.imagePhotographerUrl,
        imagePageUrl: imageQuery.data.imagePageUrl,
        imageProvider: imageQuery.data.imageProvider,
        imageDownloadLocation: imageQuery.data.imageDownloadLocation,
        imageCandidates: imageQuery.data.imageCandidates,
        unsplashQuery: imageQuery.data.unsplashQuery,
      }
    }

    if (previewQuery.isSuccess) {
      return mergeCsvRowOverDraft(row, previewQuery.data)
    }

    return csvRowToEmptyDraft(row)
  })()

  const generationFailed = contentComplete
    ? imageQuery.isError
    : previewQuery.isError
  const conflictWordId = getConflictWordId(createMutation.error)

  return (
    <WizardShell progressLabel={progressLabel} onCancel={onCancel}>
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-8">
        <p className="mb-4 text-sm text-orange-900/70">
          {session.target.kind === 'collection'
            ? 'Se guardará en la colección (y en el catálogo si es nueva).'
            : 'Se guardará en el catálogo global.'}
          {contentComplete
            ? row.unsplashQuery
              ? ' Texto del CSV; solo se busca imagen en Unsplash.'
              : ' Texto del CSV; se genera la frase de búsqueda y la imagen.'
            : null}
        </p>

        {generationFailed ? (
          <div className="mb-6" role="status">
            <p className="text-sm text-orange-900/70">
              {contentComplete
                ? 'No se pudo obtener la imagen. Puedes continuar sin ella o reintentar.'
                : 'No se pudo generar automáticamente. Puedes completar la tarjeta a mano o reintentar.'}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() =>
                void (contentComplete
                  ? imageQuery.refetch()
                  : previewQuery.refetch())
              }
            >
              Reintentar generación
            </Button>
          </div>
        ) : null}

        {createMutation.isError ? (
          <div className="mb-6" role="alert">
            {conflictWordId && session.target.kind === 'catalog' ? (
              <>
                <p className="text-sm text-red-700">
                  Esta pareja ya existe en el catálogo. Se omitirá al continuar.
                </p>
                <Button
                  className="mt-3"
                  onClick={() => onAdvance(nextSession(session))}
                >
                  Continuar
                </Button>
              </>
            ) : (
              <p className="text-sm text-red-700">
                No se pudo guardar la palabra. Inténtalo de nuevo.
              </p>
            )}
          </div>
        ) : null}

        <WordCardForm
          key={`${draft.spanish}|${draft.russian}|${generationFailed ? 'manual' : 'ai'}`}
          initial={draft}
          spanishEditable
          submitLabel="Guardar y siguiente"
          submittingLabel="Guardando…"
          isSubmitting={createMutation.isPending}
          saveError={conflictWordId ? null : createMutation.error}
          conflictMessage="Esta palabra ya existe en el catálogo."
          onSubmit={(payload: UpdateWordCardInput) => {
            createMutation.mutate(updatePayloadToWordDraft(payload))
          }}
          onCancel={onCancel}
        />
      </div>
    </WizardShell>
  )
}

function WizardShell({
  progressLabel,
  onCancel,
  children,
}: {
  progressLabel: string
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <main className="flex min-h-svh flex-col bg-orange-50 text-orange-950">
      <header className="shrink-0 border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Importar CSV
            </h1>
            <p className="mt-1 text-sm text-orange-900/70">{progressLabel}</p>
          </div>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </header>
      {children}
    </main>
  )
}

function nextSession(session: CsvWordImportSession): CsvWordImportSession {
  return {
    ...session,
    index: session.index + 1,
  }
}

function getConflictWordId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null
  }

  const conflict = error as AdminConflictError
  return typeof conflict.wordId === 'string' ? conflict.wordId : null
}
