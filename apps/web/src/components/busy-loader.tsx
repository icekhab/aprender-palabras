export function BusyLoader({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-5"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="relative size-16" aria-hidden>
        <span className="absolute inset-0 rounded-full border-2 border-orange-200" />
        <span className="word-gen-spin absolute inset-0 rounded-full border-2 border-transparent border-t-orange-600" />
        <span className="word-gen-pulse absolute inset-2.5 rounded-full bg-orange-500/20" />
        <span className="absolute inset-[1.15rem] rounded-full bg-orange-600/80" />
      </div>
      <p className="text-sm font-medium text-orange-900/70">{label}</p>
    </div>
  )
}
