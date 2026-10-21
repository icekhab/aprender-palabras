export function AppSplash() {
  return (
    <main
      className="grid min-h-svh place-items-center bg-orange-100 px-5"
      role="status"
      aria-label="Cargando"
    >
      <span className="sr-only">Cargando</span>
      <div className="flex flex-col items-center gap-4">
        <img
          src="/pwa-icon.svg"
          alt=""
          width={96}
          height={96}
          className="size-24 rounded-2xl"
        />
        <p className="text-lg font-bold tracking-tight text-orange-950">
          Aprender Palabras
        </p>
      </div>
    </main>
  )
}
