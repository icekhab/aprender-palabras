import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  IOS_MIC_RELEASE_MS,
  micReleaseSettleMs,
  releaseMicToPlayback,
  unlockPlaybackAudioSession,
} from './audio-session'

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

describe('releaseMicToPlayback', () => {
  it('ends on playback after kicking auto', () => {
    const audioSession = { type: 'play-and-record' }
    const types: string[] = []
    Object.defineProperty(audioSession, 'type', {
      get: () => types[types.length - 1] ?? 'play-and-record',
      set: (value: string) => {
        types.push(value)
      },
      configurable: true,
    })

    vi.stubGlobal('navigator', {
      ...navigator,
      audioSession,
    })

    releaseMicToPlayback()

    expect(types).toEqual(['playback', 'auto', 'playback'])
  })

  it('no-ops when audioSession is missing', () => {
    vi.stubGlobal('navigator', { ...navigator })
    expect(() => releaseMicToPlayback()).not.toThrow()
  })
})

describe('micReleaseSettleMs', () => {
  it('returns settle delay on iPhone UA', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5,
    })

    expect(micReleaseSettleMs()).toBe(IOS_MIC_RELEASE_MS)
  })

  it('returns 0 on desktop', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    })

    expect(micReleaseSettleMs()).toBe(0)
  })
})
