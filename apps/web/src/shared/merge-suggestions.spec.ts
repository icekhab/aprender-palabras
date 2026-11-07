import { describe, expect, it } from 'vitest'
import { mergeSuggestions } from './merge-suggestions'

describe('mergeSuggestions', () => {
  it('keeps DB order and appends AI-only rows without duplicates', () => {
    const merged = mergeSuggestions(
      [
        {
          spanish: 'coche',
          russian: 'автомобиль',
          wordId: 'w1',
          progress: 10,
        },
        {
          spanish: 'el coche',
          russian: 'машина',
          wordId: 'w2',
          progress: null,
        },
      ],
      [
        {
          spanish: 'Coche',
          russian: 'Автомобиль',
          wordId: null,
          progress: null,
        },
        {
          spanish: 'conducir',
          russian: 'водить',
          wordId: null,
          progress: null,
        },
      ],
    )

    expect(merged).toEqual([
      {
        spanish: 'coche',
        russian: 'автомобиль',
        wordId: 'w1',
        progress: 10,
      },
      {
        spanish: 'el coche',
        russian: 'машина',
        wordId: 'w2',
        progress: null,
      },
      {
        spanish: 'conducir',
        russian: 'водить',
        wordId: null,
        progress: null,
      },
    ])
  })
})
