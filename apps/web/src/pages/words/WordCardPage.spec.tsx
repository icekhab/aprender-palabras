import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WordCardPage } from './WordCardPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderCard(cardId = 'card-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/words/${cardId}`]}>
        <Routes>
          <Route path="/words/:cardId" element={<WordCardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WordCardPage', () => {
  it('renders card fields from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input)
        if (url === '/api/words/card-1') {
          return new Response(
            JSON.stringify({
              id: 'card-1',
              wordId: 'word-1',
              spanish: 'esperar',
              russian: 'ждать',
              additionalTranslations: ['ожидать'],
              definitionEs: 'Tener esperanza.',
              examples: ['Espero tu llamada.'],
              partOfSpeech: 'verbo',
              gender: null,
              wrongRussian: ['a', 'b', 'c'],
              wrongSpanish: ['x', 'y', 'z'],
              imageUrl: null,
              imagePhotographerName: null,
              imagePhotographerUrl: null,
              imagePageUrl: null,
              imageProvider: null,
              progress: 60,
              inDictionary: true,
              source: 'manual',
              addedAt: '2026-10-18T12:00:00.000Z',
              ready: true,
              missingFields: [],
              canEdit: true,
              lessons: [
                { id: 'lesson-1', courseId: 'course-1', title: 'Uno' },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    renderCard()

    expect(await screen.findByText('esperar')).toBeInTheDocument()
    expect(screen.getByText('ждать')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Progreso 60%. Doble clic para reiniciar.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Editar palabra')).toBeInTheDocument()
    expect(screen.getByText('Espero tu llamada.')).toBeInTheDocument()
    expect(screen.queryByText('Lecciones')).not.toBeInTheDocument()
    expect(screen.queryByText('Traducciones adicionales')).not.toBeInTheDocument()
    expect(screen.getByText('Definición')).toBeInTheDocument()
  })
})
