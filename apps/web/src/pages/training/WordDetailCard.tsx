import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { SpeakButton } from '@/components/speak-button'
import { UnsplashAttribution } from '@/components/unsplash-attribution'

export function WordDetailCard({ word }: { word: TrainerSessionWord }) {
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
              <UnsplashAttribution
                photographerName={photographerName}
                photographerUrl={photographerUrl}
                variant="overlay"
              />
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
            wordId={word.wordId}
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
              <li key={example}>
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
