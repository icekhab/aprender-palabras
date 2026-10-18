const VOICE_STORAGE_KEY = 'aprender-palabras.spanishVoiceURI'

export function getSpanishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return []
  }

  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith('es'))
}

export function getPreferredSpanishVoiceURI(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(VOICE_STORAGE_KEY)
}

export function setPreferredSpanishVoiceURI(voiceURI: string | null): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!voiceURI) {
    window.localStorage.removeItem(VOICE_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(VOICE_STORAGE_KEY, voiceURI)
}

export function getPreferredSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = getSpanishVoices()
  if (voices.length === 0) {
    return null
  }

  const preferredURI = getPreferredSpanishVoiceURI()
  if (preferredURI) {
    const preferred = voices.find((voice) => voice.voiceURI === preferredURI)
    if (preferred) {
      return preferred
    }
  }

  return voices[0] ?? null
}

export function speakSpanish(text: string): void {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed || typeof window === 'undefined' || !window.speechSynthesis) {
    return
  }

  const utterance = new SpeechSynthesisUtterance(trimmed)
  const preferredVoice = getPreferredSpanishVoice()

  if (preferredVoice) {
    utterance.voice = preferredVoice
    utterance.lang = preferredVoice.lang
  } else {
    utterance.lang = 'es-ES'
  }

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
