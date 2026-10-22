import { unlockPlaybackAudioSession } from './audio-session'

type AudioContextConstructor = typeof AudioContext

let audioContext: AudioContext | null = null
const buffers = new Map<string, AudioBuffer>()
const loading = new Map<string, Promise<AudioBuffer | null>>()
let currentSource: AudioBufferSourceNode | null = null

export function wordAudioUrl(wordId: string): string {
  return `/api/speech/${wordId}`
}

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

async function loadWordBuffer(wordId: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(wordId)
  if (cached) {
    return cached
  }

  const inFlight = loading.get(wordId)
  if (inFlight) {
    return inFlight
  }

  const context = getAudioContext()
  if (!context) {
    return null
  }

  const task = (async () => {
    try {
      const response = await fetch(wordAudioUrl(wordId), {
        credentials: 'same-origin',
        headers: { Accept: 'audio/mpeg' },
      })
      if (!response.ok) {
        return null
      }
      const data = await response.arrayBuffer()
      const buffer = await context.decodeAudioData(data.slice(0))
      buffers.set(wordId, buffer)
      return buffer
    } catch {
      return null
    } finally {
      loading.delete(wordId)
    }
  })()

  loading.set(wordId, task)
  return task
}

/** Download and decode all word clips before a training session starts. */
export async function preloadWordAudio(wordIds: string[]): Promise<void> {
  const unique = [...new Set(wordIds.filter(Boolean))]
  if (unique.length === 0) {
    return
  }

  const context = getAudioContext()
  if (context) {
    await ensureRunning(context)
  }

  await Promise.all(unique.map((id) => loadWordBuffer(id)))
}

export function stopSpeech(): void {
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
export function resetSpeechForTests(): void {
  stopSpeech()
  audioContext = null
  buffers.clear()
  loading.clear()
}

export function speakWord(wordId: string): void {
  const trimmed = wordId.trim()
  if (!trimmed || typeof window === 'undefined') {
    return
  }

  const context = getAudioContext()
  if (!context) {
    return
  }

  stopSpeech()

  void (async () => {
    await ensureRunning(context)
    const buffer = await loadWordBuffer(trimmed)
    if (!buffer) {
      return
    }

    stopSpeech()

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
