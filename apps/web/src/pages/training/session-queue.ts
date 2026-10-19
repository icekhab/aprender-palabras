import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { shuffleInPlace } from './exercise1'

export const GROUP_SIZE = 5
export const MAX_EXERCISE_TYPE = 5

export type ExerciseType = 1 | 2 | 3 | 4 | 5

export type SessionStep =
  | {
      kind: 'intro'
      id: string
      word: TrainerSessionWord
    }
  | {
      kind: 'exercise'
      id: string
      type: ExerciseType
      word: TrainerSessionWord
    }

/** Shuffle once, then split into fixed-size chunks (last chunk may be smaller). */
export function chunkGroups<T>(items: T[], size: number = GROUP_SIZE): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size))
  }
  return groups
}

function emitIntro(
  steps: SessionStep[],
  group: TrainerSessionWord[],
  groupIndex: number,
): void {
  const introWords = shuffleInPlace(group.filter((word) => word.showIntro))
  for (const word of introWords) {
    steps.push({
      kind: 'intro',
      id: `intro:g${groupIndex}:${word.userCardId}`,
      word,
    })
  }
}

function emitType(
  steps: SessionStep[],
  group: TrainerSessionWord[],
  groupIndex: number,
  type: ExerciseType,
): void {
  const blockWords = shuffleInPlace([...group])
  for (const word of blockWords) {
    steps.push({
      kind: 'exercise',
      id: `ex${type}:g${groupIndex}:${word.userCardId}`,
      type,
      word,
    })
  }
}

/**
 * Build the flat session queue:
 * 1. Shuffle words → chunk into groups of ≤5.
 * 2. Per group: intro (if needed) just before that group's first exercise.
 * 3. Bootstrap: G0 gets intro + types 1–2; each later group starts with intro + type 1,
 *    with one G0 advance between introductions (not after the last).
 * 4. Then round-robin types among groups in order G1, G0, G2, G3, … until all have types 1–5.
 *
 * Error retries (when enqueued by the session UI) always append to the end — never regroup.
 */
export function buildSessionQueue(words: TrainerSessionWord[]): SessionStep[] {
  if (words.length === 0) {
    return []
  }

  const groups = chunkGroups(shuffleInPlace([...words]), GROUP_SIZE)
  const n = groups.length
  const steps: SessionStep[] = []
  const nextType: number[] = Array.from({ length: n }, () => 1)

  const group0 = groups[0]!
  emitIntro(steps, group0, 0)
  emitType(steps, group0, 0, 1)
  emitType(steps, group0, 0, 2)
  nextType[0] = 3

  for (let g = 1; g < n; g += 1) {
    const group = groups[g]!
    emitIntro(steps, group, g)
    emitType(steps, group, g, 1)
    nextType[g] = 2

    if (g < n - 1 && nextType[0]! <= MAX_EXERCISE_TYPE) {
      emitType(steps, group0, 0, nextType[0]! as ExerciseType)
      nextType[0]! += 1
    }
  }

  const rrOrder =
    n === 1 ? [0] : [1, 0, ...Array.from({ length: n - 2 }, (_, i) => i + 2)]

  while (nextType.some((type) => type <= MAX_EXERCISE_TYPE)) {
    let progressed = false
    for (const g of rrOrder) {
      if (nextType[g]! <= MAX_EXERCISE_TYPE) {
        emitType(steps, groups[g]!, g, nextType[g]! as ExerciseType)
        nextType[g]! += 1
        progressed = true
      }
    }
    if (!progressed) {
      break
    }
  }

  return steps
}
