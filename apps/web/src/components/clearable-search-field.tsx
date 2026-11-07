import { X } from 'lucide-react'
import { useRef, type InputHTMLAttributes } from 'react'

type ClearableSearchFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'className'
> & {
  value: string
  onChange: (value: string) => void
  className?: string
}

const INPUT_CLASS =
  'h-10 w-full rounded-lg border border-orange-200 bg-white py-2 pr-10 pl-3 outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200'

export function ClearableSearchField({
  value,
  onChange,
  className,
  ...inputProps
}: ClearableSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showClear = value.length > 0

  return (
    <div className={className ? `relative ${className}` : 'relative'}>
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
      {showClear ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-orange-900/45 hover:bg-orange-100 hover:text-orange-900 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200"
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
