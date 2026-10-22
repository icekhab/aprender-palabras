import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  playFeedbackSound,
  resetFeedbackSoundForTests,
  stopFeedbackSound,
} from './feedback-sound'

afterEach(() => {
  resetFeedbackSoundForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubWebAudio(options?: {
  contextState?: AudioContextState
  resume?: () => Promise<void>
  start?: () => void
  stop?: () => void
}) {
  const start = options?.start ?? vi.fn()
  const stop = options?.stop ?? vi.fn()
  const resume = options?.resume ?? vi.fn().mockResolvedValue(undefined)
  const connect = vi.fn()
  const disconnect = vi.fn()
  const decodeAudioData = vi
    .fn()
    .mockResolvedValue({ duration: 0.1 } as AudioBuffer)

  class MockSource {
    buffer: AudioBuffer | null = null
    onended: (() => void) | null = null
    connect = connect
    disconnect = disconnect
    start = start
    stop = stop
  }

  class MockAudioContext {
    state: AudioContextState = options?.contextState ?? 'running'
    destination = {}
    resume = resume
    decodeAudioData = decodeAudioData
    createBufferSource() {
      return new MockSource() as unknown as AudioBufferSourceNode
    }
  }

  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }),
  )

  return { start, stop, resume, decodeAudioData }
}

describe('playFeedbackSound', () => {
  it('plays the correct sound through Web Audio', async () => {
    const { start, decodeAudioData } = stubWebAudio()

    playFeedbackSound('correct')
    await vi.waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledOnce()
      expect(start).toHaveBeenCalledOnce()
    })
  })

  it('loads the incorrect sound url', async () => {
    const { start } = stubWebAudio()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    vi.stubGlobal('fetch', fetchMock)

    playFeedbackSound('incorrect')
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/sounds/incorrect.mp3')
      expect(start).toHaveBeenCalledOnce()
    })
  })

  it('loads the tap sound url', async () => {
    const { start } = stubWebAudio()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    vi.stubGlobal('fetch', fetchMock)

    playFeedbackSound('tap')
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/sounds/tap.mp3')
      expect(start).toHaveBeenCalledOnce()
    })
  })

  it('loads the win sound url', async () => {
    const { start } = stubWebAudio()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    vi.stubGlobal('fetch', fetchMock)

    playFeedbackSound('win')
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/sounds/win.mp3')
      expect(start).toHaveBeenCalledOnce()
    })
  })

  it('stops the current sound', async () => {
    const { start, stop } = stubWebAudio()

    playFeedbackSound('win')
    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledOnce()
    })

    stopFeedbackSound()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('resumes a suspended audio context', async () => {
    const resume = vi.fn().mockResolvedValue(undefined)
    const { start } = stubWebAudio({
      contextState: 'suspended',
      resume,
    })

    playFeedbackSound('correct')
    await vi.waitFor(() => {
      expect(resume).toHaveBeenCalled()
      expect(start).toHaveBeenCalledOnce()
    })
  })
})
