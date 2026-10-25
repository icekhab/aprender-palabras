import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WordCardEditPage } from './WordCardEditPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderEdit(cardId = 'card-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/words/${cardId}/edit`]}>
        <Routes>
          <Route path="/words/:cardId/edit" element={<WordCardEditPage />} />
          <Route path="/words/:cardId" element={<p>card view</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const cardPayload = {
  id: 'card-1',
  wordId: 'word-1',
  spanish: 'cocodrilo',
  russian: 'крокодил',
  additionalTranslations: [],
  definitionEs: 'Reptil grande.',
  examples: ['Vi un cocodrilo.', 'El cocodrilo nada.'],
  partOfSpeech: 'sustantivo',
  gender: 'masculine',
  wrongRussian: ['слон', 'тигр', 'лев'],
  wrongSpanish: ['gato', 'perro', 'oso'],
  imageUrl: null,
  imagePhotographerName: null,
  imagePhotographerUrl: null,
  imagePageUrl: null,
  imageProvider: null,
  progress: 0,
  inDictionary: true,
  source: 'manual',
  addedAt: '2026-10-18T12:00:00.000Z',
  ready: true,
  missingFields: [],
  canEdit: true,
  lessons: [],
}

describe('WordCardEditPage', () => {
  it('blocks save when required fields are empty and shows gender for sustantivo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input)
        if (url === '/api/words/card-1') {
          return new Response(JSON.stringify(cardPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    renderEdit()

    expect(await screen.findByDisplayValue('крокодил')).toBeInTheDocument()
    expect(screen.getByLabelText('Género')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('крокодил'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('La traducción es obligatoria.'),
    ).toBeInTheDocument()
  })

  it('saves valid changes via PATCH', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      if (url === '/api/words/card-1' && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify(cardPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url === '/api/words/card-1' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { russian: string }
        return new Response(
          JSON.stringify({ ...cardPayload, russian: body.russian }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderEdit()

    const translation = await screen.findByDisplayValue('крокодил')
    fireEvent.change(translation, { target: { value: 'аллигатор' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(screen.getByText('card view')).toBeInTheDocument()
    })

    const patchCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PATCH',
    )
    expect(patchCall).toBeTruthy()
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      russian: 'аллигатор',
      partOfSpeech: 'sustantivo',
      gender: 'masculine',
    })
  })
})
