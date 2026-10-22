import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ElevenLabsService } from '../integrations/elevenlabs/elevenlabs.service.js'
import { PrismaService } from '../prisma.service.js'

@Injectable()
export class WordAudioService {
  private readonly logger = new Logger(WordAudioService.name)
  private readonly inFlight = new Map<string, Promise<Buffer | null>>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly elevenLabsService: ElevenLabsService,
  ) {}

  isConfigured(): boolean {
    return this.elevenLabsService.isConfigured()
  }

  /** Generate and store mp3 when missing. Safe to call concurrently. */
  async ensureWordAudio(wordId: string): Promise<boolean> {
    const buffer = await this.getOrCreateAudio(wordId)
    return buffer !== null
  }

  async ensureWordsAudio(wordIds: string[]): Promise<void> {
    const unique = [...new Set(wordIds)]
    await Promise.all(unique.map((id) => this.ensureWordAudio(id)))
  }

  async getAudioMp3(wordId: string): Promise<Buffer> {
    const buffer = await this.getOrCreateAudio(wordId)
    if (!buffer) {
      throw new ServiceUnavailableException('Speech audio unavailable')
    }
    return buffer
  }

  private async getOrCreateAudio(wordId: string): Promise<Buffer | null> {
    const existing = await this.prisma.wordAudio.findUnique({
      where: { wordId },
      select: { mp3: true },
    })
    if (existing?.mp3 && existing.mp3.length > 0) {
      return Buffer.from(existing.mp3.buffer, existing.mp3.byteOffset, existing.mp3.byteLength)
    }

    const inFlight = this.inFlight.get(wordId)
    if (inFlight) {
      return inFlight
    }

    const task = this.generateAndStore(wordId)
    this.inFlight.set(wordId, task)
    try {
      return await task
    } finally {
      this.inFlight.delete(wordId)
    }
  }

  private async generateAndStore(wordId: string): Promise<Buffer | null> {
    const word = await this.prisma.word.findUnique({
      where: { id: wordId },
      select: {
        id: true,
        spanish: true,
        audio: { select: { mp3: true } },
      },
    })

    if (!word) {
      throw new NotFoundException('Word not found')
    }

    if (word.audio?.mp3 && word.audio.mp3.length > 0) {
      return Buffer.from(
        word.audio.mp3.buffer,
        word.audio.mp3.byteOffset,
        word.audio.mp3.byteLength,
      )
    }

    if (!this.elevenLabsService.isConfigured()) {
      this.logger.warn(`Skipping TTS for ${wordId}: ElevenLabs not configured`)
      return null
    }

    const mp3 = await this.elevenLabsService.synthesizeSpeech(word.spanish)
    if (!mp3) {
      return null
    }

    const mp3Bytes = new Uint8Array(mp3)

    await this.prisma.wordAudio.upsert({
      where: { wordId },
      create: { wordId, mp3: mp3Bytes },
      update: { mp3: mp3Bytes },
    })

    return mp3
  }
}
