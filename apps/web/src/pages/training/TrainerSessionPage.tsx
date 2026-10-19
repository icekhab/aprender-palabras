import { useQuery } from '@tanstack/react-query'
import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { SpeakButton } from '@/components/speak-button'
import { ApiError } from '../../shared/api/auth'
import { getTrainerSession } from '../../shared/api/training'
import { speakSpanish } from '../../shared/speech'

const TRAINER_SESSION_QUERY_KEY = (id: string) =>
  ['training', 'session', id] as const

export function TrainerSessionPage() {
  const { trainerId = '' } = useParams()
  const navigate = useNavigate()
  const [introIndex, setIntroIndex] = useState(0)
  const [exitOpen, setExitOpen] = useState(false)

  const sessionQuery = useQuery({
    queryKey: TRAINER_SESSION_QUERY_KEY(trainerId),
    queryFn: ({ signal }) => getTrainerSession(trainerId, signal),
    enabled: Boolean(trainerId),
  })

  const introWords = useMemo(
    () => sessionQuery.data?.words.filter((word) => word.showIntro) ?? [],
    [sessionQuery.data],
  )
  const currentWord = introWords[introIndex] ?? null

  useEffect(() => {
    if (!sessionQuery.isSuccess) {
      return
    }

    if (introWords.length === 0) {
      void navigate('/', { replace: true })
    }
  }, [sessionQuery.isSuccess, introWords.length, navigate])

  useEffect(() => {
    if (!currentWord) {
      return
    }

    speakSpanish(currentWord.spanish)
  }, [currentWord])

  if (sessionQuery.isPending) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6 sm:px-8">
        <p className="text-sm text-orange-900/70">Cargando entrenamiento…</p>
      </main>
    )
  }

  if (sessionQuery.isError) {
    const notFound =
      sessionQuery.error instanceof ApiError && sessionQuery.error.status === 404

    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6 sm:px-8">
        <p role="alert" className="text-sm text-red-700">
          {notFound
            ? 'Este entrenamiento no está disponible.'
            : 'No se pudo cargar el entrenamiento.'}
        </p>
        <Button
          type="button"
          className="mt-4 bg-orange-700 hover:bg-orange-800"
          onClick={() => void navigate('/')}
        >
          Volver al inicio
        </Button>
      </main>
    )
  }

  if (!currentWord) {
    return null
  }

  const handleVale = () => {
    if (introIndex >= introWords.length - 1) {
      void navigate('/', { replace: true })
      return
    }
    setIntroIndex((value) => value + 1)
  }

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col bg-orange-50/40">
      <header className="flex shrink-0 items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6">
        <button
          type="button"
          aria-label="Cerrar"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-orange-900 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
          onClick={() => setExitOpen(true)}
        >
          <X className="size-5" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-orange-900/70">
          {sessionQuery.data.sourceLabel}
        </p>
        <p
          className="shrink-0 text-sm font-semibold text-orange-950 tabular-nums"
          aria-live="polite"
        >
          {introIndex + 1} / {introWords.length}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-8">
        <IntroWordCard word={currentWord} />
      </div>

      <div className="shrink-0 border-t border-orange-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <Button
          type="button"
          className="h-11 w-full bg-orange-700 text-base hover:bg-orange-800"
          onClick={handleVale}
        >
          Vale
        </Button>
      </div>

      {exitOpen ? (
        <ExitConfirmModal
          onCancel={() => setExitOpen(false)}
          onConfirm={() => {
            setExitOpen(false)
            void navigate('/')
          }}
        />
      ) : null}
    </main>
  )
}

function IntroWordCard({ word }: { word: TrainerSessionWord }) {
  const meta = grammarMeta(word)
  const photographerName = word.imagePhotographerName
  const photographerUrl = word.imagePhotographerUrl

  return (
    <article className="space-y-5">
      <div className="overflow-hidden rounded-2xl">
        {word.imageUrl ? (
          <div className="relative">
            <img
              src={word.imageUrl}
              alt=""
              className="h-52 w-full object-cover sm:h-64"
            />
            {photographerName && photographerUrl ? (
              <p className="absolute right-2 bottom-2 max-w-[70%] truncate rounded bg-black/40 px-1.5 py-0.5 text-[10px] leading-tight text-white/85">
                <a
                  href={photographerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {photographerName}
                </a>
                {word.imagePageUrl ? (
                  <>
                    {' · '}
                    <a
                      href={word.imagePageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      Unsplash
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            className="flex h-40 items-center justify-center bg-orange-100/80 text-sm text-orange-900/50"
            aria-hidden
          >
            Sin imagen
          </div>
        )}

        <div className="flex items-center gap-3 bg-orange-700 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {word.spanish}
            </p>
            <p className="mt-0.5 text-base text-white/85 sm:text-lg">
              {word.russian}
            </p>
          </div>
          <SpeakButton
            text={word.spanish}
            size="lg"
            variant="onAccent"
            className="shrink-0"
          />
        </div>
      </div>

      {meta || word.definitionEs ? (
        <div className="space-y-2">
          {meta ? (
            <p className="text-sm font-medium text-orange-900/70">{meta}</p>
          ) : null}
          {word.definitionEs ? (
            <p className="text-orange-950">{word.definitionEs}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="text-sm font-medium text-orange-900/70">Ejemplos</p>
        {word.examples.length > 0 ? (
          <ul className="mt-1 space-y-2">
            {word.examples.map((example) => (
              <li key={example} className="flex items-start gap-2">
                <SpeakButton text={example} size="xs" />
                <p className="text-orange-950 leading-6">{example}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-orange-900/40">Sin datos</p>
        )}
      </div>
    </article>
  )
}

function grammarMeta(word: TrainerSessionWord): string | null {
  const parts: string[] = []
  if (word.partOfSpeech) {
    parts.push(word.partOfSpeech)
  }
  if (word.gender === 'masculine') {
    parts.push('masculino')
  } else if (word.gender === 'feminine') {
    parts.push('femenino')
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function ExitConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-orange-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-training-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
        <h2
          id="exit-training-title"
          className="text-xl font-bold tracking-tight"
        >
          ¿Salir del entrenamiento?
        </h2>
        <p className="mt-3 text-sm text-orange-950/80">
          Perderás el progreso de este entrenamiento.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-orange-700 hover:bg-orange-800"
            onClick={onConfirm}
          >
            Salir
          </Button>
        </div>
      </div>
    </div>
  )
}
