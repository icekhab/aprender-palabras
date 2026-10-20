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

/**
 * Personal exercise-type chain for a card:
 * prefix 1 (+ 2 if trained ≤2 times), then a random permutation of 3/4/5.
 * Call once per word and reuse — shuffle is not stable across calls.
 */
export function typesForWord(word: TrainerSessionWord): ExerciseType[] {
  const later = shuffleInPlace([3, 4, 5] as ExerciseType[])
  return word.completedTrainerCount <= 2
    ? [1, 2, ...later]
    : [1, ...later]
}

function maxRoundsForGroup(
  group: TrainerSessionWord[],
  chains: Map<string, ExerciseType[]>,
): number {
  let max = 0
  for (const word of group) {
    max = Math.max(max, chains.get(word.userCardId)!.length)
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
  chains: Map<string, ExerciseType[]>,
): void {
  const roundSteps: SessionStep[] = []
  for (const word of group) {
    const type = chains.get(word.userCardId)![roundIndex]
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
 * 2. Per word: fix personal chain (1, optional 2, shuffled 3/4/5).
 * 3. Per group: intro (if needed) just before that group's first round.
 * 4. Bootstrap: G0 gets intro + rounds 0–1; each later group starts with intro + round 0,
 *    with one G0 advance between introductions (not after the last).
 * 5. Then round-robin remaining rounds among groups in order G1, G0, G2, G3, …
 *
 * Each round emits the N-th type from each word's personal chain (may mix types).
 * Error retries (when enqueued by the session UI) always append to the end — never regroup.
 */
export function buildSessionQueue(words: TrainerSessionWord[]): SessionStep[] {
  if (words.length === 0) {
    return []
  }

  const shuffled = shuffleInPlace([...words])
  const chains = new Map<string, ExerciseType[]>()
  for (const word of shuffled) {
    chains.set(word.userCardId, typesForWord(word))
  }

  const groups = chunkGroups(shuffled, GROUP_SIZE)
  const n = groups.length
  const steps: SessionStep[] = []
  const nextRound: number[] = Array.from({ length: n }, () => 0)
  const maxRounds = groups.map((group) => maxRoundsForGroup(group, chains))

  const group0 = groups[0]!
  emitIntro(steps, group0, 0)
  emitRound(steps, group0, 0, 0, chains)
  emitRound(steps, group0, 0, 1, chains)
  nextRound[0] = 2

  for (let g = 1; g < n; g += 1) {
    const group = groups[g]!
    emitIntro(steps, group, g)
    emitRound(steps, group, g, 0, chains)
    nextRound[g] = 1

    if (g < n - 1 && nextRound[0]! < maxRounds[0]!) {
      emitRound(steps, group0, 0, nextRound[0]!, chains)
      nextRound[0]! += 1
    }
  }

  const rrOrder =
    n === 1 ? [0] : [1, 0, ...Array.from({ length: n - 2 }, (_, i) => i + 2)]

  while (nextRound.some((round, g) => round < maxRounds[g]!)) {
    let progressed = false
    for (const g of rrOrder) {
      if (nextRound[g]! < maxRounds[g]!) {
        emitRound(steps, groups[g]!, g, nextRound[g]!, chains)
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
