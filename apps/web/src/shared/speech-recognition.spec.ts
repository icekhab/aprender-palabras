import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSpeechRecognition,
  ensureMicrophonePermission,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  resetMicrophonePermissionForTests,
} from './speech-recognition'

afterEach(() => {
  resetMicrophonePermissionForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ensureMicrophonePermission', () => {
  it('primes via getUserMedia once and stops tracks', async () => {
    const stop = vi.fn<() => void>()
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () =>
      ({
        getTracks: () => [{ stop }],
      }) as unknown as MediaStream,
    )
    const audioSession = { type: 'playback' }

    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
      audioSession,
    })

    await expect(ensureMicrophonePermission()).resolves.toEqual({ ok: true })
    await expect(ensureMicrophonePermission()).resolves.toEqual({ ok: true })
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
    expect(audioSession.type).toBe('playback')
  })

  it('leaves playback before getUserMedia', async () => {
    const types: string[] = []
    const audioSession = { type: 'playback' }
    Object.defineProperty(audioSession, 'type', {
      get: () => types[types.length - 1] ?? 'playback',
      set: (value: string) => {
        types.push(value)
      },
      configurable: true,
    })

    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () => {
      expect(types.at(-1)).toBe('auto')
      return {
        getTracks: () => [{ stop: vi.fn<() => void>() }],
      } as unknown as MediaStream
    })

    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
      audioSession,
    })

    await expect(ensureMicrophonePermission()).resolves.toEqual({ ok: true })
    expect(types[0]).toBe('auto')
  })

  it('maps denial to denied', async () => {
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () => {
      throw new DOMException('Permission denied', 'NotAllowedError')
    })

    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
      audioSession: { type: 'playback' },
    })

    await expect(ensureMicrophonePermission()).resolves.toEqual({
      ok: false,
      reason: 'denied',
    })
  })

  it('falls through to SpeechRecognition on non-denied priming errors', async () => {
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () => {
      throw new DOMException(
        'AudioSession category is not compatible with audio capture',
        'InvalidStateError',
      )
    })

    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
      audioSession: { type: 'playback' },
    })

    await expect(ensureMicrophonePermission()).resolves.toEqual({ ok: true })
  })

  it('force re-prompts after a previous grant cache', async () => {
    const stop = vi.fn<() => void>()
    const getUserMedia = vi.fn<
      (constraints: MediaStreamConstraints) => Promise<MediaStream>
    >(async () =>
      ({
        getTracks: () => [{ stop }],
      }) as unknown as MediaStream,
    )

    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
      audioSession: { type: 'auto' },
    })

    await ensureMicrophonePermission()
    expect(getUserMedia).toHaveBeenCalledOnce()

    await ensureMicrophonePermission({ force: true })
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })
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

  it('wires handlers and defaults to es-ES', async () => {
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

    const abortPromise = session?.abort()
    expect(instances[0]?.abort).toHaveBeenCalledOnce()
    // Abort waits for onend (or timeout) before clearing handlers.
    instances[0]?.onend?.()
    await abortPromise
    expect(instances[0]?.onresult).toBeNull()
  })

  it('abort resolves after onend', async () => {
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
      abort = vi.fn<() => void>(() => {
        this.onend?.()
      })
    }

    vi.stubGlobal('webkitSpeechRecognition', MockRecognition)

    const session = createSpeechRecognition({
      onResult: vi.fn<(transcript: string, isFinal: boolean) => void>(),
      onError: vi.fn<(error: string) => void>(),
      onEnd: vi.fn<() => void>(),
    })

    await expect(session?.abort()).resolves.toBeUndefined()
  })
})
