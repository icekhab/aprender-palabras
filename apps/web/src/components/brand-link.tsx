import { Link } from 'react-router-dom'

export function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={
        className ??
        'text-sm font-bold tracking-[0.12em] text-orange-700 uppercase hover:text-orange-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-200 rounded-sm'
      }
    >
      Palabras
    </Link>
  )
}
