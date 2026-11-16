import { CSV_WORD_IMPORT_MAX_ROWS } from '@aprender-palabras/contracts'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import { listCollections } from '@/shared/api/collections'
import { COLLECTIONS_QUERY_KEY } from '../collections/query-keys'
import {
  CSV_WORD_IMPORT_TEMPLATE,
  parseCsvWordImport,
  type CsvWordImportRow,
} from './csv-word-import'
import {
  saveCsvWordImportSession,
  type CsvWordImportTarget,
} from './csv-word-import-session'

export function AdminWordsImportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetCollectionId = searchParams.get('collectionId')?.trim() || null

  const [targetKind, setTargetKind] = useState<'catalog' | 'collection'>(
    presetCollectionId ? 'collection' : 'catalog',
  )
  const [collectionId, setCollectionId] = useState(presetCollectionId ?? '')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<CsvWordImportRow[] | null>(null)
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  const collectionsQuery = useQuery({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: ({ signal }) => listCollections(undefined, signal),
    enabled: targetKind === 'collection' && !presetCollectionId,
  })

  const collectionOptions = useMemo(() => {
    const data = collectionsQuery.data
    if (!data) {
      return []
    }

    const byId = new Map(
      [...data.mine, ...data.catalog, ...data.adminDrafts].map((item) => [
        item.id,
        item,
      ]),
    )

    return [...byId.values()].sort((a, b) =>
      a.title.localeCompare(b.title, 'es'),
    )
  }, [collectionsQuery.data])

  const canStart =
    rows !== null &&
    rows.length > 0 &&
    errors.length === 0 &&
    (targetKind === 'catalog' || collectionId.length > 0)

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setFileName(file.name)
    setParseError(null)
    setRows(null)
    setErrors([])

    try {
      const text = await file.text()
      const result = parseCsvWordImport(text)
      setRows(result.rows)
      setErrors(result.errors)
      if (result.rows.length === 0 && result.errors.length === 0) {
        setParseError('No hay filas válidas en el CSV.')
      }
    } catch {
      setParseError('No se pudo leer el archivo.')
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`${CSV_WORD_IMPORT_TEMPLATE}\n`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'plantilla-palabras.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function startImport() {
    if (!rows || rows.length === 0) {
      return
    }

    const target: CsvWordImportTarget =
      targetKind === 'collection' && collectionId
        ? { kind: 'collection', collectionId }
        : { kind: 'catalog' }

    saveCsvWordImportSession({
      target,
      rows,
      index: 0,
    })
    navigate('/admin/words/import/run', { replace: true })
  }

  const cancelPath = presetCollectionId
    ? `/colecciones/${presetCollectionId}`
    : '/admin/words'

  return (
    <main className="flex min-h-svh flex-col bg-orange-50 text-orange-950">
      <header className="shrink-0 border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Importar CSV
            </h1>
          </div>
          <Button variant="outline" onClick={() => navigate(cancelPath)}>
            Cancelar
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-5 py-6 sm:px-8">
        <p className="text-sm text-orange-900/70">
          Hasta {CSV_WORD_IMPORT_MAX_ROWS} palabras. Columnas obligatorias:
          spanish, russian. Opcional unsplashQuery (frase en inglés para
          Unsplash). Si el resto de campos está completo, no se llama a la IA de
          texto — solo se busca la imagen.
        </p>

        <div className="space-y-3">
          <p className="text-sm font-medium">Destino</p>
          {presetCollectionId ? (
            <p className="text-sm text-orange-900/70">
              Colección actual (id: {presetCollectionId})
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="import-target"
                  checked={targetKind === 'catalog'}
                  onChange={() => setTargetKind('catalog')}
                />
                Catálogo global
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="import-target"
                  checked={targetKind === 'collection'}
                  onChange={() => setTargetKind('collection')}
                />
                Colección
              </label>
              {targetKind === 'collection' ? (
                <select
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-200"
                  value={collectionId}
                  onChange={(event) => setCollectionId(event.target.value)}
                >
                  <option value="">Elige una colección…</option>
                  {collectionOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={downloadTemplate}>
            Descargar plantilla
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              Elegir CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => void onFileChange(event)}
              />
            </label>
          </Button>
        </div>

        {fileName ? (
          <p className="text-sm text-orange-900/70">Archivo: {fileName}</p>
        ) : null}

        {parseError ? (
          <p className="text-sm text-red-700" role="alert">
            {parseError}
          </p>
        ) : null}

        {rows ? (
          <div className="space-y-2 rounded-xl border border-orange-100 bg-white/80 p-4">
            <p className="text-sm">
              Filas válidas: <strong>{rows.length}</strong>
            </p>
            {errors.length > 0 ? (
              <div className="space-y-1" role="alert">
                <p className="text-sm text-red-700">
                  Errores ({errors.length}): corrige el CSV para continuar.
                </p>
                <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-red-700">
                  {errors.slice(0, 20).map((error) => (
                    <li key={`${error.line}-${error.message}`}>
                      Línea {error.line}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-orange-900/70">
                Sin errores. Puedes empezar el asistente.
              </p>
            )}
          </div>
        ) : null}

        <Button disabled={!canStart} onClick={startImport}>
          Empezar
        </Button>
      </div>
    </main>
  )
}
