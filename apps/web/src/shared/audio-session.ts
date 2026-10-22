type AudioSessionNavigator = Navigator & {
  audioSession?: {
    type: string
  }
}

/**
 * Route page audio through iOS media playback so the silent/ringer switch
 * does not mute Web Audio (Safari default is ambient).
 */
export function unlockPlaybackAudioSession(): void {
  if (typeof navigator === 'undefined') {
    return
  }

  const session = (navigator as AudioSessionNavigator).audioSession
  if (!session) {
    return
  }

  try {
    session.type = 'playback'
  } catch {
    // Older / unsupported AudioSession implementations.
  }
}
