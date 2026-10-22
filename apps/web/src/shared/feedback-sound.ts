import { unlockPlaybackAudioSession } from './audio-session'

export type FeedbackSoundKind = 'correct' | 'incorrect' | 'tap' | 'win'

const SOUND_URLS: Record<FeedbackSoundKind, string> = {
  correct: '/sounds/correct.mp3',
  incorrect: '/sounds/incorrect.mp3',
  tap: '/sounds/tap.mp3',
  win: '/sounds/win.mp3',
}

type AudioContextConstructor = typeof AudioContext

let audioContext: AudioContext | null = null
const buffers = new Map<FeedbackSoundKind, AudioBuffer>()
const loading = new Map<FeedbackSoundKind, Promise<AudioBuffer | null>>()
let currentSource: AudioBufferSourceNode | null = null

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }

  return (
    window.AudioContext ??
    (
      window as Window & {
        webkitAudioContext?: AudioContextConstructor
      }
    ).webkitAudioContext ??
    null
  )
}

function getAudioContext(): AudioContext | null {
  const Ctx = getAudioContextConstructor()
  if (!Ctx) {
    return null
  }

  if (!audioContext) {
    audioContext = new Ctx()
  }

  return audioContext
}

async function ensureRunning(context: AudioContext): Promise<void> {
  unlockPlaybackAudioSession()
  if (context.state === 'suspended') {
    try {
      await context.resume()
    } catch {
      // Ignore if the browser blocks resume outside a gesture.
    }
  }
}

async function loadBuffer(
  kind: FeedbackSoundKind,
): Promise<AudioBuffer | null> {
  const cached = buffers.get(kind)
  if (cached) {
    return cached
  }

  const inFlight = loading.get(kind)
  if (inFlight) {
    return inFlight
  }

  const context = getAudioContext()
  if (!context) {
    return null
  }

  const task = (async () => {
    try {
      const response = await fetch(SOUND_URLS[kind])
      if (!response.ok) {
        return null
      }
      const data = await response.arrayBuffer()
      const buffer = await context.decodeAudioData(data.slice(0))
      buffers.set(kind, buffer)
      return buffer
    } catch {
      return null
    } finally {
      loading.delete(kind)
    }
  })()

  loading.set(kind, task)
  return task
}

export function stopFeedbackSound(): void {
  if (!currentSource) {
    return
  }

  try {
    currentSource.stop()
  } catch {
    // Already stopped.
  }
  try {
    currentSource.disconnect()
  } catch {
    // Ignore.
  }
  currentSource = null
}

/** Clears cached audio state between unit tests. */
export function resetFeedbackSoundForTests(): void {
  stopFeedbackSound()
  audioContext = null
  buffers.clear()
  loading.clear()
}

export function playFeedbackSound(kind: FeedbackSoundKind): void {
  if (typeof window === 'undefined') {
    return
  }

  const context = getAudioContext()
  if (!context) {
    return
  }

  stopFeedbackSound()

  void (async () => {
    await ensureRunning(context)
    const buffer = await loadBuffer(kind)
    if (!buffer) {
      return
    }

    // Drop stale plays if a newer sound was requested while loading.
    stopFeedbackSound()

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    currentSource = source
    source.onended = () => {
      if (currentSource === source) {
        currentSource = null
      }
    }

    try {
      source.start(0)
    } catch {
      currentSource = null
    }
  })()
}
