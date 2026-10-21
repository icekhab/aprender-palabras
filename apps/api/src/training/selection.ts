export const MAX_TRAINER_WORDS = 12
export const MIN_TRAINER_WORDS = 1

export interface SelectionCard {
  userCardId: string
  wordId: string
  progress: number
  lastTrainedAt: Date | null
  completedTrainerCount: number
  showCount: number
  addedAt: Date
  source: 'manual' | 'lesson'
  /** Lesson positions (1-based) that contain this word for the user. */
  lessonPositions: number[]
}

export interface BuiltTrainer {
  slot: number
  kind: 'daily' | 'extra'
  sourceLabel: string
  userCardIds: string[]
}

export type RandomFn = () => number

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function madridDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function resolveAnchor(
  lastCompletedTrainerAt: Date | null | undefined,
  now: Date = new Date(),
): Date {
  return lastCompletedTrainerAt ?? now
}

export function compareByPriority(
  a: SelectionCard,
  b: SelectionCard,
  random: RandomFn = Math.random,
): number {
  if (a.progress !== b.progress) {
    return a.progress - b.progress
  }

  const aTime = a.lastTrainedAt?.getTime() ?? Number.NEGATIVE_INFINITY
  const bTime = b.lastTrainedAt?.getTime() ?? Number.NEGATIVE_INFINITY
  if (aTime !== bTime) {
    return aTime - bTime
  }

  if (a.showCount !== b.showCount) {
    return a.showCount - b.showCount
  }

  return random() < 0.5 ? -1 : 1
}

function sortByPriority(
  cards: SelectionCard[],
  random: RandomFn,
): SelectionCard[] {
  return [...cards].sort((a, b) => compareByPriority(a, b, random))
}

/** Shuffle, then stable-sort by progress ascending (ties keep random order). */
function sortByProgressThenRandom(
  cards: SelectionCard[],
  random: RandomFn,
): SelectionCard[] {
  const shuffled = [...cards]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]!
    shuffled[index] = shuffled[swapIndex]!
    shuffled[swapIndex] = current
  }
  return shuffled.sort((a, b) => a.progress - b.progress)
}

function isStarted(card: SelectionCard): boolean {
  return card.completedTrainerCount > 0
}

function isUnstarted(card: SelectionCard): boolean {
  return card.completedTrainerCount === 0
}

function isManual(card: SelectionCard): boolean {
  return card.source === 'manual'
}

function ageMs(card: SelectionCard, anchor: Date): number {
  return anchor.getTime() - card.addedAt.getTime()
}

function isRecent14(card: SelectionCard, anchor: Date): boolean {
  return ageMs(card, anchor) < 14 * MS_PER_DAY
}

function isAgeLessThan28(card: SelectionCard, anchor: Date): boolean {
  return ageMs(card, anchor) < 28 * MS_PER_DAY
}

function trainedAtLeast28BeforeAnchor(
  card: SelectionCard,
  anchor: Date,
): boolean {
  if (card.lastTrainedAt === null) {
    return false
  }
  return anchor.getTime() - card.lastTrainedAt.getTime() >= 28 * MS_PER_DAY
}

function inLessonOffsets(
  card: SelectionCard,
  currentPosition: number,
  offsets: number[],
): boolean {
  return card.lessonPositions.some((position) =>
    offsets.some((offset) => position === currentPosition - offset),
  )
}

function sortNewestFirst(
  cards: SelectionCard[],
  random: RandomFn,
): SelectionCard[] {
  return [...cards].sort((a, b) => {
    const aDay = Date.UTC(
      a.addedAt.getUTCFullYear(),
      a.addedAt.getUTCMonth(),
      a.addedAt.getUTCDate(),
    )
    const bDay = Date.UTC(
      b.addedAt.getUTCFullYear(),
      b.addedAt.getUTCMonth(),
      b.addedAt.getUTCDate(),
    )
    if (aDay !== bDay) {
      return bDay - aDay
    }
    return compareByPriority(a, b, random)
  })
}

/** Take unused cards from pool only — no reserve, no day repeats. */
function pickFromPool(
  pool: SelectionCard[],
  usedToday: Set<string>,
  random: RandomFn,
  max = MAX_TRAINER_WORDS,
): SelectionCard[] {
  const unused = sortByPriority(
    pool.filter((card) => !usedToday.has(card.userCardId)),
    random,
  )
  return unused.slice(0, max)
}

/** Progress ascending only; equal progress stays randomly ordered. */
function pickByProgressThenRandom(
  pool: SelectionCard[],
  usedToday: Set<string>,
  random: RandomFn,
  max = MAX_TRAINER_WORDS,
): SelectionCard[] {
  const unused = sortByProgressThenRandom(
    pool.filter((card) => !usedToday.has(card.userCardId)),
    random,
  )
  return unused.slice(0, max)
}

function weightedSampleWithoutReplacement(
  cards: SelectionCard[],
  count: number,
  weightOf: (card: SelectionCard, rank: number, total: number) => number,
  random: RandomFn,
): SelectionCard[] {
  const sorted = sortByPriority(cards, random)
  const remaining = sorted.map((card, index) => ({
    card,
    weight: weightOf(card, index + 1, sorted.length),
  }))
  const picked: SelectionCard[] = []

  while (picked.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0)
    let ticket = random() * totalWeight
    let chosenIndex = remaining.length - 1
    for (let index = 0; index < remaining.length; index += 1) {
      ticket -= remaining[index]!.weight
      if (ticket <= 0) {
        chosenIndex = index
        break
      }
    }
    const [chosen] = remaining.splice(chosenIndex, 1)
    picked.push(chosen!.card)
  }

  return picked
}

export function pickExtraTrainerWords(
  cards: SelectionCard[],
  usedToday: Set<string>,
  random: RandomFn = Math.random,
): SelectionCard[] {
  if (cards.length === 0) {
    return []
  }

  return weightedSampleWithoutReplacement(
    cards,
    Math.min(MAX_TRAINER_WORDS, cards.length),
    (card) => {
      const base = 1 + (100 - card.progress) / 20
      return usedToday.has(card.userCardId) ? base / 3 : base
    },
    random,
  )
}

export function buildDailyTrainers(input: {
  cards: SelectionCard[]
  currentLessonPosition: number | null
  /** Last completed trainer time; windows are relative to this (or now). */
  anchor?: Date
  now?: Date
  random?: RandomFn
}): BuiltTrainer[] {
  const now = input.now ?? new Date()
  const anchor = input.anchor ?? now
  const random = input.random ?? Math.random
  const cards = input.cards
  const usedToday = new Set<string>()
  const trainers: BuiltTrainer[] = []

  const commit = (
    slot: number,
    sourceLabel: string,
    picked: SelectionCard[],
  ) => {
    if (picked.length < MIN_TRAINER_WORDS) {
      return
    }
    for (const card of picked) {
      usedToday.add(card.userCardId)
    }
    trainers.push({
      slot,
      kind: 'daily',
      sourceLabel,
      userCardIds: picked.map((card) => card.userCardId),
    })
  }

  if (input.currentLessonPosition === null) {
    const started = cards.filter(isStarted)
    const unstarted = cards.filter(isUnstarted)

    const pool12 = started.filter((card) => isRecent14(card, anchor))
    for (const slot of [1, 2] as const) {
      commit(
        slot,
        'Palabras empezadas',
        pickFromPool(pool12, usedToday, random),
      )
    }

    commit(
      3,
      'Recientes',
      pickFromPool(
        started.filter((card) => isAgeLessThan28(card, anchor)),
        usedToday,
        random,
      ),
    )

    commit(
      4,
      'Repaso lejano',
      pickByProgressThenRandom(
        started.filter((card) => trainedAtLeast28BeforeAnchor(card, anchor)),
        usedToday,
        random,
      ),
    )

    commit(
      5,
      'Palabras nuevas',
      sortNewestFirst(
        unstarted.filter((card) => !usedToday.has(card.userCardId)),
        random,
      ).slice(0, MAX_TRAINER_WORDS),
    )

    return trainers
  }

  const currentPosition = input.currentLessonPosition
  const started = cards.filter(isStarted)
  const unstarted = cards.filter(isUnstarted)

  const l0Started = started.filter((card) =>
    inLessonOffsets(card, currentPosition, [0]),
  )
  const l1to4Started = started.filter((card) =>
    inLessonOffsets(card, currentPosition, [1, 2, 3, 4]),
  )
  const manualRecent14Started = started.filter(
    (card) => isManual(card) && isRecent14(card, anchor),
  )
  const ageLess28Started = started.filter((card) =>
    isAgeLessThan28(card, anchor),
  )

  const pool12 = uniqueById([...l0Started, ...manualRecent14Started])
  for (const slot of [1, 2] as const) {
    commit(slot, 'Lección actual', pickFromPool(pool12, usedToday, random))
  }

  const pool3 = uniqueById([...l1to4Started, ...ageLess28Started])
  commit(3, 'Lecciones recientes', pickFromPool(pool3, usedToday, random))

  commit(
    4,
    'Repaso lejano',
    pickByProgressThenRandom(
      started.filter((card) => trainedAtLeast28BeforeAnchor(card, anchor)),
      usedToday,
      random,
    ),
  )

  commit(
    5,
    'Nuevas y próxima lección',
    sortNewestFirst(
      unstarted.filter((card) => !usedToday.has(card.userCardId)),
      random,
    ).slice(0, MAX_TRAINER_WORDS),
  )

  return trainers
}

function uniqueById(cards: SelectionCard[]): SelectionCard[] {
  const seen = new Set<string>()
  const result: SelectionCard[] = []
  for (const card of cards) {
    if (seen.has(card.userCardId)) {
      continue
    }
    seen.add(card.userCardId)
    result.push(card)
  }
  return result
}

export function buildExtraTrainer(input: {
  cards: SelectionCard[]
  usedToday: Set<string>
  random?: RandomFn
}): BuiltTrainer | null {
  const random = input.random ?? Math.random
  const picked = pickExtraTrainerWords(input.cards, input.usedToday, random)
  if (picked.length < MIN_TRAINER_WORDS) {
    return null
  }
  return {
    slot: 0,
    kind: 'extra',
    sourceLabel: 'Entrenamiento extra',
    userCardIds: picked.map((card) => card.userCardId),
  }
}
