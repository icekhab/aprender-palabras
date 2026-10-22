import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  preloadWordAudio,
  resetSpeechForTests,
  speakWord,
  wordAudioUrl,
} from './speech'

afterEach(() => {
  resetSpeechForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('word speech', () => {
  it('builds the speech audio URL', () => {
    expect(wordAudioUrl('word-1')).toBe('/api/speech/word-1')
  })

  it('preloads and speaks audio from the API', async () => {
    const start = vi.fn<() => void>()
    const connect = vi.fn<() => void>()
    const source = {
      buffer: null as AudioBuffer | null,
      connect,
      start,
      stop: vi.fn<() => void>(),
      disconnect: vi.fn<() => void>(),
      onended: null as (() => void) | null,
    }

    const decodeAudioData = vi.fn<
      (data: ArrayBuffer) => Promise<AudioBuffer>
    >(async () => ({ duration: 0.5 }) as AudioBuffer)
    const resume = vi.fn<() => Promise<void>>(async () => undefined)
    const createBufferSource = vi.fn<() => typeof source>(() => source)

    class MockAudioContext {
      state = 'running'
      resume = resume
      decodeAudioData = decodeAudioData
      createBufferSource = createBufferSource
    }

    vi.stubGlobal('AudioContext', MockAudioContext)

    const fetchMock = vi.fn<typeof fetch>(async () => {
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    await preloadWordAudio(['word-1', 'word-1'])

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/speech/word-1',
      expect.objectContaining({
        credentials: 'same-origin',
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    speakWord('word-1')
    await vi.waitFor(() => {
      expect(start).toHaveBeenCalled()
    })
    expect(connect).toHaveBeenCalled()
  })
})
