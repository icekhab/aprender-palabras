import { UNSPLASH_HOME_REFERRAL_URL } from '@/shared/unsplash'

export function UnsplashAttribution({
  photographerName,
  photographerUrl,
  variant,
}: {
  photographerName: string
  photographerUrl: string
  variant: 'caption' | 'overlay'
}) {
  const linkClassName =
    variant === 'overlay' ? 'hover:underline' : 'underline'

  const content = (
    <>
      Foto de{' '}
      <a
        href={photographerUrl}
        target="_blank"
        rel="noreferrer"
        className={linkClassName}
      >
        {photographerName}
      </a>{' '}
      en{' '}
      <a
        href={UNSPLASH_HOME_REFERRAL_URL}
        target="_blank"
        rel="noreferrer"
        className={linkClassName}
      >
        Unsplash
      </a>
    </>
  )

  if (variant === 'overlay') {
    return (
      <p className="absolute right-2 bottom-2 max-w-[85%] truncate rounded bg-black/40 px-1.5 py-0.5 text-[10px] leading-tight text-white/85">
        {content}
      </p>
    )
  }

  return (
    <figcaption className="mt-2 text-xs text-orange-900/60">{content}</figcaption>
  )
}
