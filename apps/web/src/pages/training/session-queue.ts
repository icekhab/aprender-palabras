import type { TrainerSessionWord } from '@aprender-palabras/contracts'
import { shuffleInPlace } from './exercise1'

/** How many words to unlock at session start (intros → type 1 → type 2). */
export const INITIAL_UNLOCK = 4
export const INJECT_BATCH_MIN = 2
export const INJECT_BATCH_MAX = 3
/** Chance to inject a new batch when both pending exercises and waiting words exist. */
export const INJECT_PROBABILITY = 0.35

export type ExerciseType = 1 | 2 | 3 | 4 | 5

/** Max attempts per (card, exercise type) including the first try (§10.1). */
export const MAX_ATTEMPTS_PER_EXERCISE = 3

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

export type ExerciseSessionStep = Extract<SessionStep, { kind: 'exercise' }>

/** Append-only retry of the same exercise; new id so choice options reshuffle. */
export function createRetryStep(
  step: ExerciseSessionStep,
  afterAttempt: number,
): ExerciseSessionStep {
  return {
    kind: 'exercise',
    id: `ex${step.type}:retry:${afterAttempt}:${step.word.userCardId}`,
    type: step.type,
    word: step.word,
  }
}

export function attemptKey(userCardId: string, type: ExerciseType): string {
  return `${userCardId}:${type}`
}

type WordState = {
  word: TrainerSessionWord
  chain: ExerciseType[]
  /** Next index in `chain` to emit. */
  nextIndex: number
}

/**
 * Personal exercise-type chain for a card:
 * - first two trainings (count 0|1): prefix 1 → 2, then shuffle of 3/4/5;
 * - after that (count ≥ 2): full shuffle of 1/3/4/5 (no type 2).
 * Call once per word and reuse — shuffle is not stable across calls.
 */
export function typesForWord(word: TrainerSessionWord): ExerciseType[] {
  if (word.completedTrainerCount >= 2) {
    return shuffleInPlace([1, 3, 4, 5] as ExerciseType[])
  }
  return [1, 2, ...shuffleInPlace([3, 4, 5] as ExerciseType[])]
}

function pickInjectSize(waitingCount: number): number {
  if (waitingCount <= 0) {
    return 0
  }
  if (waitingCount < INJECT_BATCH_MIN) {
    return waitingCount
  }
  const span = INJECT_BATCH_MAX - INJECT_BATCH_MIN + 1
  const preferred =
    Math.floor(Math.random() * span) + INJECT_BATCH_MIN
  return Math.min(preferred, waitingCount)
}

function emitIntros(
  steps: SessionStep[],
  words: TrainerSessionWord[],
  batchId: number,
): void {
  const introWords = shuffleInPlace(words.filter((word) => word.showIntro))
  for (const word of introWords) {
    steps.push({
      kind: 'intro',
      id: `intro:b${batchId}:${word.userCardId}`,
      word,
    })
  }
}

/** Emit the current chain step for each state whose next type equals `type`, then advance. */
function emitTypeBlock(
  steps: SessionStep[],
  states: WordState[],
  type: ExerciseType,
  batchId: number,
): void {
  const ready = states.filter(
    (state) => state.chain[state.nextIndex] === type,
  )
  shuffleInPlace(ready)
  for (const state of ready) {
    steps.push({
      kind: 'exercise',
      id: `ex${type}:b${batchId}:${state.word.userCardId}`,
      type,
      word: state.word,
    })
    state.nextIndex += 1
  }
}

function createStates(words: TrainerSessionWord[]): WordState[] {
  return words.map((word) => ({
    word,
    chain: typesForWord(word),
    nextIndex: 0,
  }))
}

/**
 * Atomic unlock block: all intros (shuffled) → all type 1 (shuffled)
 * → optional all type 2 for eligible (shuffled). Nothing else interleaved.
 */
function unlockBatch(
  steps: SessionStep[],
  batchWords: TrainerSessionWord[],
  batchId: number,
  includeType2: boolean,
): WordState[] {
  const states = createStates(batchWords)
  emitIntros(steps, batchWords, batchId)
  emitTypeBlock(steps, states, 1, batchId)
  if (includeType2) {
    emitTypeBlock(steps, states, 2, batchId)
  }
  return states
}

/**
 * Drip-feed session queue:
 * 1. Shuffle words; unlock first 4 with intros → type1 → type2 (atomic).
 * 2. Loop: either inject 2–3 waiting words (intros → type1 atomic) or emit one
 *    random next exercise among unlocked words.
 * 3. Type 2+ for injected words come later via the random pending picks.
 *
 * Error retries (when enqueued by the session UI) always append to the end.
 */
export function buildSessionQueue(words: TrainerSessionWord[]): SessionStep[] {
  if (words.length === 0) {
    return []
  }

  const shuffled = shuffleInPlace([...words])
  const steps: SessionStep[] = []
  let batchId = 0

  const initial = shuffled.slice(0, INITIAL_UNLOCK)
  const waiting = shuffled.slice(INITIAL_UNLOCK)
  const unlocked: WordState[] = unlockBatch(steps, initial, batchId, true)
  batchId += 1

  let guard = 0
  while (guard < 10_000) {
    guard += 1

    const pending = unlocked.filter(
      (state) => state.nextIndex < state.chain.length,
    )

    if (pending.length === 0 && waiting.length === 0) {
      break
    }

    const shouldInject =
      waiting.length > 0 &&
      (pending.length === 0 || Math.random() < INJECT_PROBABILITY)

    if (shouldInject) {
      const size = pickInjectSize(waiting.length)
      const batchWords = waiting.splice(0, size)
      unlocked.push(...unlockBatch(steps, batchWords, batchId, false))
      batchId += 1
      continue
    }

    const pick = pending[Math.floor(Math.random() * pending.length)]!
    const type = pick.chain[pick.nextIndex]!
    steps.push({
      kind: 'exercise',
      id: `ex${type}:b${batchId}:r${pick.nextIndex}:${pick.word.userCardId}`,
      type,
      word: pick.word,
    })
    pick.nextIndex += 1
  }

  return steps
}
