import { useQuery } from '@tanstack/react-query'
import './App.css'
import { getHello } from './shared/api/hello'

function App() {
  const hello = useQuery({
    queryKey: ['hello'],
    queryFn: getHello,
    retry: false,
  })

  return (
    <main className="welcome">
      <p className="eyebrow">Aprender Palabras</p>

      {hello.isPending && <p role="status">Загрузка…</p>}

      {hello.isError && (
        <div role="alert">
          <p>Не удалось получить ответ API.</p>
          <button type="button" onClick={() => void hello.refetch()}>
            Повторить
          </button>
        </div>
      )}

      {hello.data && <h1>{hello.data.message}</h1>}
    </main>
  )
}

export default App
