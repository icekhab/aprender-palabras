import type { TrainerSessionWord } from '@aprender-palabras/contracts'

export interface Exercise1Step {
  userCardId: string
  spanish: string
  correctRussian: string
  options: string[]
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
  return items
}

export function buildExercise1Step(word: TrainerSessionWord): Exercise1Step {
  return {
    userCardId: word.userCardId,
    spanish: word.spanish,
    correctRussian: word.russian,
    options: shuffleInPlace([word.russian, ...word.wrongRussian.slice(0, 3)]),
  }
}
