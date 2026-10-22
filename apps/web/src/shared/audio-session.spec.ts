import { afterEach, describe, expect, it, vi } from 'vitest'
import { unlockPlaybackAudioSession } from './audio-session'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('unlockPlaybackAudioSession', () => {
  it('sets navigator.audioSession.type to playback when available', () => {
    const audioSession = { type: 'ambient' }
    vi.stubGlobal('navigator', {
      ...navigator,
      audioSession,
    })

    unlockPlaybackAudioSession()

    expect(audioSession.type).toBe('playback')
  })

  it('no-ops when audioSession is missing', () => {
    vi.stubGlobal('navigator', { ...navigator })
    expect(() => unlockPlaybackAudioSession()).not.toThrow()
  })
})
