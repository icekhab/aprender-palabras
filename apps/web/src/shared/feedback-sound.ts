export type FeedbackSoundKind = 'correct' | 'incorrect' | 'tap' | 'win'

const SOUND_URLS: Record<FeedbackSoundKind, string> = {
  correct: '/sounds/correct.mp3',
  incorrect: '/sounds/incorrect.mp3',
  tap: '/sounds/tap.mp3',
  win: '/sounds/win.mp3',
}

let currentAudio: HTMLAudioElement | null = null

export function stopFeedbackSound(): void {
  if (!currentAudio) {
    return
  }
  try {
    currentAudio.pause()
    currentAudio.currentTime = 0
  } catch {
    // Ignore environments without media playback.
  }
  currentAudio = null
}

export function playFeedbackSound(kind: FeedbackSoundKind): void {
  if (typeof window === 'undefined') {
    return
  }

  stopFeedbackSound()

  const audio = new Audio(SOUND_URLS[kind])
  currentAudio = audio
  try {
    const playing = audio.play()
    if (playing && typeof playing.catch === 'function') {
      void playing.catch(() => {
        if (currentAudio === audio) {
          currentAudio = null
        }
      })
    }
  } catch {
    currentAudio = null
  }
}
