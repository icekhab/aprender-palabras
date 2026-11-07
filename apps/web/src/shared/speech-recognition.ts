import {
  prepareAudioSessionForMicrophone,
  releaseMicToPlayback,
} from './audio-session'

/** Minimal Web Speech Recognition surface we use (Chrome/Safari prefixes). */

/** Tab-lifetime cache after a successful getUserMedia prime. */
let microphonePermissionGranted = false

export type MicrophonePermissionResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'unavailable' }

/**
 * Ask for mic via getUserMedia once, then release tracks immediately.
 * Helps iOS Safari remember Allow more reliably than SpeechRecognition alone.
 *
 * Must leave audioSession `playback` first — iOS rejects capture otherwise.
 * Non-denied priming failures fall through so SpeechRecognition can still run.
 * Pass `{ force: true }` to re-prompt after a previous denial in this tab.
 */
export async function ensureMicrophonePermission(
  options?: { force?: boolean },
): Promise<MicrophonePermissionResult> {
  if (options?.force) {
    microphonePermissionGranted = false
  }

  if (microphonePermissionGranted) {
    return { ok: true }
  }

  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    // Fall through to SpeechRecognition; some environments omit mediaDevices.
    return { ok: true }
  }

  prepareAudioSessionForMicrophone()

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const track of stream.getTracks()) {
      track.stop()
    }
    microphonePermissionGranted = true
    releaseMicToPlayback()
    return { ok: true }
  } catch (error) {
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { ok: false, reason: 'denied' }
    }
    // e.g. InvalidStateError while session was playback — let STT try.
    return { ok: true }
  }
}

/** Clears the tab cache between unit tests. */
export function resetMicrophonePermissionForTests(): void {
  microphonePermissionGranted = false
}

export type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

export type SpeechRecognitionErrorEventLike = {
  error: string
  message?: string
}

export type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }

  const speechWindow = window as SpeechWindow
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  )
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

export type SpeechRecognitionHandlers = {
  lang?: string
  onResult: (transcript: string, isFinal: boolean) => void
  onError: (error: string) => void
  onEnd: () => void
}

export type SpeechRecognitionSession = {
  start: () => void
  stop: () => void
  abort: () => void
}

/**
 * Create a one-shot recognition session. Call start() from a user gesture.
 * Always call abort() on unmount to detach listeners.
 */
export function createSpeechRecognition(
  handlers: SpeechRecognitionHandlers,
): SpeechRecognitionSession | null {
  const Recognition = getSpeechRecognitionConstructor()
  if (!Recognition) {
    return null
  }

  const recognition = new Recognition()
  recognition.lang = handlers.lang ?? 'es-ES'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1]
    if (!last) {
      return
    }
    const transcript = last[0]?.transcript ?? ''
    handlers.onResult(transcript, last.isFinal)
  }

  recognition.onerror = (event) => {
    handlers.onError(event.error)
  }

  recognition.onend = () => {
    handlers.onEnd()
  }

  return {
    start: () => {
      recognition.start()
    },
    stop: () => {
      try {
        recognition.stop()
      } catch {
        // Already stopped.
      }
    },
    abort: () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        // Already stopped.
      }
    },
  }
}
