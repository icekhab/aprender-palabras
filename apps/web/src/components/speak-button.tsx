import { Volume2 } from 'lucide-react'
import { speakSpanish } from '../shared/speech'

export function SpeakButton({
  text,
  size = 'sm',
  variant = 'default',
  className = '',
}: {
  text: string
  size?: 'xs' | 'sm' | 'lg'
  variant?: 'default' | 'onAccent'
  className?: string
}) {
  const tone =
    variant === 'onAccent'
      ? 'text-white hover:bg-white/15 focus-visible:ring-white/40'
      : 'text-orange-700 hover:bg-orange-100 focus-visible:ring-orange-200'

  const box =
    size === 'lg' ? 'size-11' : size === 'xs' ? 'size-6' : 'size-8'
  const icon =
    size === 'lg' ? 'size-6' : size === 'xs' ? 'size-3.5' : 'size-4'

  return (
    <button
      type="button"
      aria-label="Escuchar"
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-3 ${tone} ${box} ${className}`}
      onClick={() => {
        speakSpanish(text)
      }}
    >
      <Volume2 className={icon} aria-hidden />
    </button>
  )
}
