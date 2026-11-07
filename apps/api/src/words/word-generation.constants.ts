/** Max async generation attempts per Word (initial + one auto-retry). */
export const WORD_GENERATION_MAX_ATTEMPTS = 2

/** Abort a single background attempt after this long. */
export const WORD_GENERATION_TIMEOUT_MS = 90_000

/** Treat `generating` as stuck after this age. */
export const WORD_GENERATION_STUCK_AFTER_MS = 5 * 60_000

/** How often the retry job scans failed / stuck words. */
export const WORD_GENERATION_RETRY_INTERVAL_MS = 30_000

export const WORD_GENERATION_ERROR_MAX_LENGTH = 500
