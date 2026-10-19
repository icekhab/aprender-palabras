import { afterEach, describe, expect, it, vi } from 'vitest'
import { playFeedbackSound } from './feedback-sound'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('playFeedbackSound', () => {
  it('plays the correct sound file', () => {
    const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    class MockAudio {
      src: string
      play = play
      constructor(src: string) {
        this.src = src
      }
    }
    vi.stubGlobal('Audio', MockAudio)

    playFeedbackSound('correct')

    expect(play).toHaveBeenCalledOnce()
  })

  it('plays the incorrect sound file', () => {
    const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    let lastSrc = ''
    class MockAudio {
      play = play
      constructor(src: string) {
        lastSrc = src
      }
    }
    vi.stubGlobal('Audio', MockAudio)

    playFeedbackSound('incorrect')

    expect(lastSrc).toBe('/sounds/incorrect.mp3')
    expect(play).toHaveBeenCalledOnce()
  })

  it('plays the tap sound file', () => {
    const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    let lastSrc = ''
    class MockAudio {
      play = play
      constructor(src: string) {
        lastSrc = src
      }
    }
    vi.stubGlobal('Audio', MockAudio)

    playFeedbackSound('tap')

    expect(lastSrc).toBe('/sounds/tap.mp3')
    expect(play).toHaveBeenCalledOnce()
  })
})
