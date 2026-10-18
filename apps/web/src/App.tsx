import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { getTests } from './shared/api/tests'

function App() {
  const tests = useQuery({
    queryKey: ['tests'],
    queryFn: getTests,
    retry: false,
  })

  return (
    <main className="grid min-h-svh place-content-center bg-orange-50 p-8 text-orange-950">
      <p className="mb-4 text-sm font-bold tracking-[0.12em] text-orange-700 uppercase">
        Aprender Palabras
      </p>
      <h1 className="mb-6 text-4xl font-bold tracking-tight">Test</h1>

      {tests.isPending && <p role="status">Загрузка…</p>}

      {tests.isError && (
        <div role="alert">
          <p>Не удалось загрузить записи.</p>
          <Button className="mt-4" onClick={() => void tests.refetch()}>
            Повторить
          </Button>
        </div>
      )}

      {tests.data && (
        <table className="min-w-72 overflow-hidden rounded-xl bg-white text-left shadow-sm">
          <thead className="bg-orange-100 text-orange-800">
            <tr>
              <th className="px-5 py-3 font-semibold" scope="col">
                Name
              </th>
              <th className="px-5 py-3 font-semibold" scope="col">
                Size
              </th>
            </tr>
          </thead>
          <tbody>
            {tests.data.map((test) => (
              <tr className="border-t border-orange-100" key={test.name}>
                <td className="px-5 py-3 font-medium">{test.name}</td>
                <td className="px-5 py-3">{test.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

export default App
