import { HttpException, HttpStatus } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { madridDateString } from '../training/selection.js'
import { QuotaService } from './quota.service.js'

function createPrismaMock() {
  const tx = {
    user: {
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  return {
    $transaction: vi.fn<
      (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
    >(async (callback) => callback(tx)),
    $executeRaw: vi.fn<(args: unknown) => Promise<number>>(),
    word: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    _tx: tx,
  }
}

describe('QuotaService', () => {
  const prisma = createPrismaMock()
  let service: QuotaService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new QuotaService(prisma as never)
  })

  it('skips daily generation quota for admin', async () => {
    prisma._tx.user.findUniqueOrThrow.mockResolvedValue({
      role: 'admin',
      dailyGenerationLimit: null,
      dailySuggestionsLimit: null,
      quotaDate: null,
      generationsCount: 0,
      suggestionsCount: 0,
    })

    await service.consumeGeneration('admin-1')
    expect(prisma._tx.user.update).not.toHaveBeenCalled()
  })

  it('rejects generation when user hits default limit of 30', async () => {
    prisma._tx.user.findUniqueOrThrow.mockResolvedValue({
      role: 'user',
      dailyGenerationLimit: null,
      dailySuggestionsLimit: null,
      quotaDate: new Date(`${madridDateString()}T00:00:00.000Z`),
      generationsCount: 30,
      suggestionsCount: 0,
    })

    await expect(service.consumeGeneration('user-1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    })
    expect(prisma._tx.user.update).not.toHaveBeenCalled()
  })

  it('uses teacher default generation limit of 100', async () => {
    prisma._tx.user.findUniqueOrThrow.mockResolvedValue({
      role: 'teacher',
      dailyGenerationLimit: null,
      dailySuggestionsLimit: null,
      quotaDate: new Date(`${madridDateString()}T00:00:00.000Z`),
      generationsCount: 99,
      suggestionsCount: 0,
    })

    await service.consumeGeneration('teacher-1')
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ generationsCount: 100 }),
      }),
    )
  })

  it('uses role defaults for suggestions (user 300 / teacher 600)', async () => {
    prisma._tx.user.findUniqueOrThrow.mockResolvedValue({
      role: 'teacher',
      dailyGenerationLimit: null,
      dailySuggestionsLimit: null,
      quotaDate: new Date(`${madridDateString()}T00:00:00.000Z`),
      generationsCount: 0,
      suggestionsCount: 599,
    })

    await service.consumeSuggestions('teacher-1')
    expect(prisma._tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ suggestionsCount: 600 }),
      }),
    )
  })

  it('rejects fourth image generation for a word', async () => {
    prisma.$executeRaw.mockResolvedValue(0)
    prisma.word.findUnique.mockResolvedValue({
      id: 'word-1',
      imageGenerationCount: 3,
    })

    await expect(service.consumeImageGeneration('word-1')).rejects.toBeInstanceOf(
      HttpException,
    )
  })

  it('increments image generation when under limit', async () => {
    prisma.$executeRaw.mockResolvedValue(1)
    await service.consumeImageGeneration('word-1')
    expect(prisma.word.findUnique).not.toHaveBeenCalled()
  })
})
