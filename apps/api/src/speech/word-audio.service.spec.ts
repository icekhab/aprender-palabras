import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WordAudioService } from './word-audio.service.js'

describe('WordAudioService.getAudioMp3', () => {
  const prisma = {
    wordAudio: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    word: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  const elevenLabsService = {
    isConfigured: vi.fn<() => boolean>(),
    synthesizeSpeech: vi.fn<(text: string) => Promise<Buffer | null>>(),
  }

  let service: WordAudioService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WordAudioService(prisma as never, elevenLabsService as never)
  })

  it('returns stored mp3 without calling ElevenLabs', async () => {
    const mp3 = Buffer.from('audio')
    prisma.wordAudio.findUnique.mockResolvedValue({ mp3 })

    await expect(service.getAudioMp3('word-1')).resolves.toEqual(mp3)
    expect(elevenLabsService.synthesizeSpeech).not.toHaveBeenCalled()
  })

  it('throws NotFound when audio is missing without generating', async () => {
    prisma.wordAudio.findUnique.mockResolvedValue(null)
    prisma.word.findUnique.mockResolvedValue({ id: 'word-1' })

    await expect(service.getAudioMp3('word-1')).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(elevenLabsService.synthesizeSpeech).not.toHaveBeenCalled()
  })
})
