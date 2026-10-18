import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPreferredSpanishVoice,
  setPreferredSpanishVoiceURI,
  speakSpanish,
} from './speech'

const VOICE_STORAGE_KEY = 'aprender-palabras.spanishVoiceURI'

afterEach(() => {
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('speech preference', () => {
  it('uses the preferred Spanish voice from localStorage', () => {
    const preferred = {
      lang: 'es-MX',
      name: 'Mexican',
      default: false,
      localService: true,
      voiceURI: 'es-mx-voice',
    }
    const other = {
      lang: 'es-ES',
      name: 'Spanish',
      default: false,
      localService: true,
      voiceURI: 'es-es-voice',
    }

    const speak = vi.fn<(utterance: SpeechSynthesisUtterance) => void>()
    const cancel = vi.fn<() => void>()
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel,
      getVoices: () => [other, preferred],
    })
    class MockUtterance {
      text: string
      lang = ''
      voice: SpeechSynthesisVoice | null = null

      constructor(text: string) {
        this.text = text
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance)

    setPreferredSpanishVoiceURI('es-mx-voice')
    expect(getPreferredSpanishVoice()?.voiceURI).toBe('es-mx-voice')
    expect(window.localStorage.getItem(VOICE_STORAGE_KEY)).toBe('es-mx-voice')

    speakSpanish('hola')

    expect(cancel).toHaveBeenCalled()
    const utterance = speak.mock.calls[0]?.[0] as SpeechSynthesisUtterance
    expect(utterance.text).toBe('hola')
    expect(utterance.voice?.voiceURI).toBe('es-mx-voice')
    expect(utterance.lang).toBe('es-MX')
  })
})
