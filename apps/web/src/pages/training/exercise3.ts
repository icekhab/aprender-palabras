import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { pickRandomItems, shuffleInPlace } from './exercise1'

export interface Exercise3Step {
  userCardId: string
  russian: string
  correctSpanish: string
  options: string[]
}

export function buildExercise3Step(word: TrainerSessionWord): Exercise3Step {
  return {
    userCardId: word.userCardId,
    russian: word.russian,
    correctSpanish: word.spanish,
    options: shuffleInPlace([
      word.spanish,
      ...pickRandomItems(word.wrongSpanish, 3),
    ]),
  }
}
