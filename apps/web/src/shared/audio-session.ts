type AudioSessionNavigator = Navigator & {
  audioSession?: {
    type: string
  }
}

/** Settle time after SpeechRecognition before Web Audio on iOS. */
export const IOS_MIC_RELEASE_MS = 400

function getAudioSession(): { type: string } | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  return (navigator as AudioSessionNavigator).audioSession ?? null
}

/**
 * Route page audio through iOS media playback so the silent/ringer switch
 * does not mute Web Audio (Safari default is ambient).
 */
export function unlockPlaybackAudioSession(): void {
  const session = getAudioSession()
  if (!session) {
    return
  }

  try {
    session.type = 'playback'
  } catch {
    // Older / unsupported AudioSession implementations.
  }
}

/**
 * Leave exclusive playback before getUserMedia / SpeechRecognition.
 * iOS rejects capture while audioSession.type is `playback`.
 */
export function prepareAudioSessionForMicrophone(): void {
  const session = getAudioSession()
  if (!session) {
    return
  }

  try {
    session.type = 'auto'
  } catch {
    // Older / unsupported AudioSession implementations.
  }
}

/**
 * After microphone / SpeechRecognition, force iOS out of capture routing
 * so word TTS is not muffled (play-and-record ducking).
 */
export function releaseMicToPlayback(): void {
  const session = getAudioSession()
  if (!session) {
    return
  }

  try {
    // Kick WebKit to leave capture category, then lock media playback.
    session.type = 'playback'
    session.type = 'auto'
    session.type = 'playback'
  } catch {
    // Older / unsupported AudioSession implementations.
  }
}

/** Delay before playing audio after mic teardown (iPhone/iPad only). */
export function micReleaseSettleMs(): number {
  if (typeof navigator === 'undefined') {
    return 0
  }

  const ua = navigator.userAgent
  const isiOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  return isiOS ? IOS_MIC_RELEASE_MS : 0
}
