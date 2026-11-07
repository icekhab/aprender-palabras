import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSpeechRecognition,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
} from './speech-recognition'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('speech recognition support', () => {
  it('reports unsupported when constructors are missing', () => {
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    expect(getSpeechRecognitionConstructor()).toBeNull()
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('detects webkitSpeechRecognition', () => {
    class MockRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onresult = null
      onerror = null
      onend = null
      start = vi.fn<() => void>()
      stop = vi.fn<() => void>()
      abort = vi.fn<() => void>()
    }

    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', MockRecognition)
    expect(isSpeechRecognitionSupported()).toBe(true)
  })
})

describe('createSpeechRecognition', () => {
  it('returns null without a constructor', () => {
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    expect(
      createSpeechRecognition({
        onResult: vi.fn<(transcript: string, isFinal: boolean) => void>(),
        onError: vi.fn<(error: string) => void>(),
        onEnd: vi.fn<() => void>(),
      }),
    ).toBeNull()
  })

  it('wires handlers and defaults to es-ES', () => {
    const instances: Array<{
      lang: string
      continuous: boolean
      interimResults: boolean
      onresult: ((event: unknown) => void) | null
      onerror: ((event: unknown) => void) | null
      onend: (() => void) | null
      start: ReturnType<typeof vi.fn<() => void>>
      abort: ReturnType<typeof vi.fn<() => void>>
    }> = []

    class MockRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn<() => void>()
      stop = vi.fn<() => void>()
      abort = vi.fn<() => void>()

      constructor() {
        instances.push(this)
      }
    }

    vi.stubGlobal('webkitSpeechRecognition', MockRecognition)

    const onResult = vi.fn<(transcript: string, isFinal: boolean) => void>()
    const onError = vi.fn<(error: string) => void>()
    const onEnd = vi.fn<() => void>()
    const session = createSpeechRecognition({ onResult, onError, onEnd })
    expect(session).not.toBeNull()
    expect(instances).toHaveLength(1)
    expect(instances[0]?.lang).toBe('es-ES')
    expect(instances[0]?.continuous).toBe(false)
    expect(instances[0]?.interimResults).toBe(true)

    session?.start()
    expect(instances[0]?.start).toHaveBeenCalledOnce()

    instances[0]?.onresult?.({
      results: [{ isFinal: true, 0: { transcript: 'hola' } }],
    })
    expect(onResult).toHaveBeenCalledWith('hola', true)

    instances[0]?.onerror?.({ error: 'no-speech' })
    expect(onError).toHaveBeenCalledWith('no-speech')

    instances[0]?.onend?.()
    expect(onEnd).toHaveBeenCalledOnce()

    session?.abort()
    expect(instances[0]?.abort).toHaveBeenCalledOnce()
    expect(instances[0]?.onresult).toBeNull()
  })
})
