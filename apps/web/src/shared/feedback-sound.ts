export type FeedbackSoundKind = 'correct' | 'incorrect' | 'tap'

const SOUND_URLS: Record<FeedbackSoundKind, string> = {
  correct: '/sounds/correct.mp3',
  incorrect: '/sounds/incorrect.mp3',
  tap: '/sounds/tap.mp3',
}

export function playFeedbackSound(kind: FeedbackSoundKind): void {
  if (typeof window === 'undefined') {
    return
  }

  const audio = new Audio(SOUND_URLS[kind])
  try {
    const playing = audio.play()
    if (playing && typeof playing.catch === 'function') {
      void playing.catch(() => {
        // Ignore autoplay / missing-file failures; UI feedback still works.
      })
    }
  } catch {
    // Ignore environments without media playback (e.g. jsdom tests).
  }
}
