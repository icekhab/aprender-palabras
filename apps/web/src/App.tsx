import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { getHello } from './shared/api/hello'

function App() {
  const hello = useQuery({
    queryKey: ['hello'],
    queryFn: getHello,
    retry: false,
  })

  return (
    <main className="grid min-h-svh place-content-center bg-orange-50 p-8 text-center text-orange-950">
      <p className="mb-4 text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
        Aprender Palabras
      </p>

      {hello.isPending && <p role="status">Загрузка…</p>}

      {hello.isError && (
        <div role="alert">
          <p>Не удалось получить ответ API.</p>
          <Button className="mt-4" onClick={() => void hello.refetch()}>
            Повторить
          </Button>
        </div>
      )}

      {hello.data && (
        <h1 className="text-[clamp(2.5rem,12vw,5rem)] leading-none font-bold tracking-[-0.04em]">
          {hello.data.message}
        </h1>
      )}
    </main>
  )
}

export default App
