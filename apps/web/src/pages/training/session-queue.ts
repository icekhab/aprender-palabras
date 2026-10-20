import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { shuffleInPlace } from './exercise1'

export const GROUP_SIZE = 5

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

/** Personal exercise-type chain for a card (type 2 only if trained ≤2 times). */
export function typesForWord(word: TrainerSessionWord): ExerciseType[] {
  return word.completedTrainerCount <= 2
    ? [1, 2, 3, 4, 5]
    : [1, 3, 4, 5]
}

function maxRoundsForGroup(group: TrainerSessionWord[]): number {
  let max = 0
  for (const word of group) {
    max = Math.max(max, typesForWord(word).length)
  }
  return max
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

/** Emit the N-th personal exercise for each word still in the chain (mixed types OK). */
function emitRound(
  steps: SessionStep[],
  group: TrainerSessionWord[],
  groupIndex: number,
  roundIndex: number,
): void {
  const roundSteps: SessionStep[] = []
  for (const word of group) {
    const type = typesForWord(word)[roundIndex]
    if (type === undefined) {
      continue
    }
    roundSteps.push({
      kind: 'exercise',
      id: `ex${type}:g${groupIndex}:r${roundIndex}:${word.userCardId}`,
      type,
      word,
    })
  }
  shuffleInPlace(roundSteps)
  steps.push(...roundSteps)
}

/**
 * Build the flat session queue:
 * 1. Shuffle words → chunk into groups of ≤5.
 * 2. Per group: intro (if needed) just before that group's first round.
 * 3. Bootstrap: G0 gets intro + rounds 0–1; each later group starts with intro + round 0,
 *    with one G0 advance between introductions (not after the last).
 * 4. Then round-robin remaining rounds among groups in order G1, G0, G2, G3, …
 *
 * Each round emits the N-th type from each word's personal chain (may mix types).
 * Error retries (when enqueued by the session UI) always append to the end — never regroup.
 */
export function buildSessionQueue(words: TrainerSessionWord[]): SessionStep[] {
  if (words.length === 0) {
    return []
  }

  const groups = chunkGroups(shuffleInPlace([...words]), GROUP_SIZE)
  const n = groups.length
  const steps: SessionStep[] = []
  const nextRound: number[] = Array.from({ length: n }, () => 0)
  const maxRounds = groups.map((group) => maxRoundsForGroup(group))

  const group0 = groups[0]!
  emitIntro(steps, group0, 0)
  emitRound(steps, group0, 0, 0)
  emitRound(steps, group0, 0, 1)
  nextRound[0] = 2

  for (let g = 1; g < n; g += 1) {
    const group = groups[g]!
    emitIntro(steps, group, g)
    emitRound(steps, group, g, 0)
    nextRound[g] = 1

    if (g < n - 1 && nextRound[0]! < maxRounds[0]!) {
      emitRound(steps, group0, 0, nextRound[0]!)
      nextRound[0]! += 1
    }
  }

  const rrOrder =
    n === 1 ? [0] : [1, 0, ...Array.from({ length: n - 2 }, (_, i) => i + 2)]

  while (nextRound.some((round, g) => round < maxRounds[g]!)) {
    let progressed = false
    for (const g of rrOrder) {
      if (nextRound[g]! < maxRounds[g]!) {
        emitRound(steps, groups[g]!, g, nextRound[g]!)
        nextRound[g]! += 1
        progressed = true
      }
    }
    if (!progressed) {
      break
    }
  }

  return steps
}
