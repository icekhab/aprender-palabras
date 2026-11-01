import {
  createWordCollectionSchema,
  type AuthUser,
  type CreateWordCollectionInput,
  type WordCollectionListItem,
} from '@aprender-palabras/contracts'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { BrandLink } from '@/components/brand-link'
import { Button } from '@/components/ui/button'
import {
  addCollectionForUser,
  createCollection,
  createCollectionTrainer,
  listCollections,
} from '@/shared/api/collections'
import { ProgressRing } from '../lessons/progress-ring'
import { COLLECTIONS_QUERY_KEY, collectionsListQueryKey } from './query-keys'

export function CollectionsPage({
  userMenu,
}: {
  userMenu: React.ReactNode
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authUser = queryClient.getQueryData<AuthUser>(['auth', 'me'])
  const isAdmin = authUser?.role === 'admin'
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const collectionsQuery = useQuery({
    queryKey: collectionsListQueryKey(debouncedSearch),
    queryFn: ({ signal }) => listCollections(debouncedSearch || undefined, signal),
  })

  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: async (collection) => {
      await queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
      setCreateOpen(false)
      navigate(`/colecciones/${collection.id}`)
    },
  })

  const addMutation = useMutation({
    mutationFn: addCollectionForUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
    },
  })

  const trainMutation = useMutation({
    mutationFn: createCollectionTrainer,
    onSuccess: (result) => {
      navigate(`/entrenamiento/${result.trainerId}`)
    },
  })

  const form = useForm<CreateWordCollectionInput>({
    resolver: zodResolver(createWordCollectionSchema),
    defaultValues: { title: '' },
  })

  const mine = collectionsQuery.data?.mine ?? []
  const catalog = collectionsQuery.data?.catalog ?? []
  const adminDrafts = collectionsQuery.data?.adminDrafts ?? []
  const isEmpty =
    collectionsQuery.isSuccess &&
    mine.length === 0 &&
    catalog.length === 0 &&
    adminDrafts.length === 0

  function onSearchChange(value: string) {
    setSearch(value)
    if (searchTimer.current !== null) {
      clearTimeout(searchTimer.current)
    }
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value.trim())
    }, 250)
  }

  return (
    <main className="min-h-svh bg-orange-50 text-orange-950">
      <header className="border-b border-orange-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <BrandLink />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              Colecciones
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>
              Volver
            </Button>
            {userMenu}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-orange-900/40"
              aria-hidden
            />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar colecciones"
              className="w-full rounded-xl border border-orange-200 bg-white py-2.5 pr-3 pl-10 text-sm outline-none focus:border-orange-400"
            />
          </div>
          {isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Nueva colección
            </Button>
          ) : null}
        </div>

        {collectionsQuery.isPending ? (
          <p className="text-sm text-orange-900/60">Cargando…</p>
        ) : null}
        {collectionsQuery.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-red-700">No se pudieron cargar las colecciones.</p>
            <Button variant="outline" onClick={() => collectionsQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-white/70 px-6 py-10 text-center">
            <FolderOpen className="mx-auto size-8 text-orange-700" aria-hidden />
            <p className="mt-3 text-sm text-orange-900/70">
              {debouncedSearch
                ? 'No hay colecciones con ese nombre.'
                : 'Aún no hay colecciones.'}
            </p>
          </div>
        ) : null}

        {mine.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-orange-900/70 uppercase">
              Mis colecciones
            </h2>
            <ul className="space-y-2">
              {mine.map((item) => (
                <CollectionRow
                  key={item.id}
                  item={item}
                  mode="mine"
                  busy={
                    addMutation.isPending ||
                    trainMutation.isPending
                  }
                  onOpen={() => navigate(`/colecciones/${item.id}`)}
                  onTrain={() => trainMutation.mutate(item.id)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {catalog.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-orange-900/70 uppercase">
              Catálogo
            </h2>
            <ul className="space-y-2">
              {catalog.map((item) => (
                <CollectionRow
                  key={item.id}
                  item={item}
                  mode="catalog"
                  busy={addMutation.isPending}
                  onOpen={() => navigate(`/colecciones/${item.id}`)}
                  onAdd={() => addMutation.mutate(item.id)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {isAdmin && adminDrafts.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-orange-900/70 uppercase">
              Borradores e inactivas
            </h2>
            <ul className="space-y-2">
              {adminDrafts.map((item) => (
                <CollectionRow
                  key={item.id}
                  item={item}
                  mode="admin"
                  busy={false}
                  onOpen={() => navigate(`/colecciones/${item.id}`)}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <form
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <h2 className="text-lg font-semibold">Nueva colección</h2>
            <input
              {...form.register('title')}
              placeholder="Título"
              className="w-full rounded-xl border border-orange-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              autoFocus
            />
            {form.formState.errors.title ? (
              <p className="text-sm text-red-700">Título obligatorio</p>
            ) : null}
            {createMutation.isError ? (
              <p className="text-sm text-red-700">No se pudo crear la colección.</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Crear
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}

function statusLabel(status: WordCollectionListItem['status']) {
  if (status === 'created') {
    return 'Creada'
  }
  if (status === 'inactive') {
    return 'Inactiva'
  }
  return 'Lista'
}

function CollectionRow({
  item,
  mode,
  busy,
  onOpen,
  onAdd,
  onTrain,
}: {
  item: WordCollectionListItem
  mode: 'mine' | 'catalog' | 'admin'
  busy: boolean
  onOpen: () => void
  onAdd?: () => void
  onTrain?: () => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-100 bg-white px-4 py-3">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
        onClick={onOpen}
      >
        {mode === 'mine' && item.progress !== null ? (
          <ProgressRing value={item.progress} />
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-medium">{item.title}</p>
          <p className="text-xs text-orange-900/55">
            {item.wordCount === 1 ? '1 palabra' : `${item.wordCount} palabras`}
            {mode === 'admin' ? ` · ${statusLabel(item.status)}` : ''}
          </p>
        </div>
      </button>
      {mode === 'mine' && item.canTrain && onTrain ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation()
            onTrain()
          }}
        >
          Entrenar
        </Button>
      ) : null}
      {mode === 'catalog' && onAdd ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation()
            onAdd()
          }}
        >
          Añadir
        </Button>
      ) : null}
    </li>
  )
}
