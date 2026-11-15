import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import type { UserRole } from '@aprender-palabras/contracts'
import { PrismaService } from '../prisma.service.js'
import { madridDateString } from '../training/selection.js'
import {
  DEFAULT_GENERATION_LIMIT,
  DEFAULT_SUGGESTIONS_LIMIT,
} from './quota.constants.js'

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserve one generation slot before calling paid APIs.
   * Admin skips. Increments after check, before external call.
   */
  async consumeGeneration(userId: string): Promise<void> {
    await this.consumeDaily(userId, 'generation')
  }

  async consumeSuggestions(userId: string): Promise<void> {
    await this.consumeDaily(userId, 'suggestions')
  }

  /**
   * Check generation quota without consuming. Used to gate AI suggestions
   * when the user cannot add new generated words today.
   */
  async assertGenerationAvailable(userId: string): Promise<void> {
    await this.assertDailyAvailable(userId, 'generation')
  }

  private async assertDailyAvailable(
    userId: string,
    kind: 'generation' | 'suggestions',
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        role: true,
        dailyGenerationLimit: true,
        dailySuggestionsLimit: true,
        quotaDate: true,
        generationsCount: true,
        suggestionsCount: true,
      },
    })

    if (!computeCanUseDailyQuota(user, kind)) {
      const role = user.role as Exclude<UserRole, 'admin'>
      if (kind === 'generation') {
        throwQuotaExceeded(
          'GENERATION_QUOTA_EXCEEDED',
          user.dailyGenerationLimit ?? DEFAULT_GENERATION_LIMIT[role],
        )
      }
      throwQuotaExceeded(
        'SUGGESTIONS_QUOTA_EXCEEDED',
        user.dailySuggestionsLimit ?? DEFAULT_SUGGESTIONS_LIMIT[role],
      )
    }
  }

  private async consumeDaily(
    userId: string,
    kind: 'generation' | 'suggestions',
  ): Promise<void> {
    const today = madridDateString()

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          role: true,
          dailyGenerationLimit: true,
          dailySuggestionsLimit: true,
          quotaDate: true,
          generationsCount: true,
          suggestionsCount: true,
        },
      })

      if (user.role === 'admin') {
        return
      }

      const role = user.role as Exclude<UserRole, 'admin'>
      const snapshot = resolveDailyQuotaSnapshot(user)
      const generationsCount = snapshot.generationsCount
      const suggestionsCount = snapshot.suggestionsCount
      const needsReset = snapshot.needsReset

      if (kind === 'generation') {
        const limit =
          user.dailyGenerationLimit ?? DEFAULT_GENERATION_LIMIT[role]
        if (generationsCount >= limit) {
          throwQuotaExceeded('GENERATION_QUOTA_EXCEEDED', limit)
        }
        await tx.user.update({
          where: { id: userId },
          data: {
            quotaDate: new Date(`${today}T00:00:00.000Z`),
            generationsCount: generationsCount + 1,
            ...(needsReset ? { suggestionsCount: 0 } : {}),
          },
        })
        return
      }

      const limit =
        user.dailySuggestionsLimit ?? DEFAULT_SUGGESTIONS_LIMIT[role]
      if (suggestionsCount >= limit) {
        throwQuotaExceeded('SUGGESTIONS_QUOTA_EXCEEDED', limit)
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          quotaDate: new Date(`${today}T00:00:00.000Z`),
          suggestionsCount: suggestionsCount + 1,
          ...(needsReset ? { generationsCount: 0 } : {}),
        },
      })
    })
  }
}

export type DailyQuotaUserSnapshot = {
  role: UserRole
  dailyGenerationLimit: number | null
  dailySuggestionsLimit: number | null
  quotaDate: Date | null
  generationsCount: number
  suggestionsCount: number
}

export function computeCanUseAiSuggestions(
  user: DailyQuotaUserSnapshot,
): boolean {
  return (
    computeCanUseDailyQuota(user, 'suggestions') &&
    computeCanUseDailyQuota(user, 'generation')
  )
}

function computeCanUseDailyQuota(
  user: DailyQuotaUserSnapshot,
  kind: 'generation' | 'suggestions',
): boolean {
  if (user.role === 'admin') {
    return true
  }

  const role = user.role as Exclude<UserRole, 'admin'>
  const snapshot = resolveDailyQuotaSnapshot(user)

  if (kind === 'generation') {
    const limit = user.dailyGenerationLimit ?? DEFAULT_GENERATION_LIMIT[role]
    return snapshot.generationsCount < limit
  }

  const limit = user.dailySuggestionsLimit ?? DEFAULT_SUGGESTIONS_LIMIT[role]
  return snapshot.suggestionsCount < limit
}

function resolveDailyQuotaSnapshot(user: DailyQuotaUserSnapshot): {
  generationsCount: number
  suggestionsCount: number
  needsReset: boolean
} {
  const today = madridDateString()
  const quotaDate = user.quotaDate
    ? madridDateString(new Date(user.quotaDate))
    : null
  const needsReset = quotaDate !== today

  return {
    generationsCount: needsReset ? 0 : user.generationsCount,
    suggestionsCount: needsReset ? 0 : user.suggestionsCount,
    needsReset,
  }
}

function throwQuotaExceeded(code: string, limit: number): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Daily quota exceeded',
      code,
      limit,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
}
