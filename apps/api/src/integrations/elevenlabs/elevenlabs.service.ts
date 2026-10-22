import { Injectable, Logger } from '@nestjs/common'

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_VOICE_ID = 'qUPtETgSYRhCRb2pfOla'
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name)
  private readonly apiKey: string | null
  private readonly voiceId: string
  private readonly modelId: string

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY?.trim() || null
    this.voiceId =
      process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID
    this.modelId =
      process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID
  }

  isConfigured(): boolean {
    return this.apiKey !== null
  }

  async synthesizeSpeech(text: string): Promise<Buffer | null> {
    if (!this.apiKey) {
      return null
    }

    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (!trimmed) {
      return null
    }

    const url = new URL(
      `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(this.voiceId)}`,
    )
    url.searchParams.set('output_format', 'mp3_44100_128')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: this.modelId,
        }),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        this.logger.error(
          `ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 500)}`,
        )
        return null
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length === 0) {
        this.logger.error('ElevenLabs TTS returned empty audio')
        return null
      }

      return bytes
    } catch (error) {
      this.logger.error('ElevenLabs TTS request failed', error)
      return null
    }
  }
}
