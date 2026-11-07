import { createHash, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  normalizeEnabledExerciseTypes,
  type AuthUser,
  type LoginInput,
  type UpdatePreferencesInput,
} from '@aprender-palabras/contracts'
import argon2 from 'argon2'
import { PrismaService } from '../prisma.service.js'
import { computeCanUseAiSuggestions } from '../quotas/quota.service.js'
import { SESSION_DURATION_MS } from './auth.constants.js'

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw'

interface CreatedSession {
  user: AuthUser
  token: string
  expiresAt: Date
}

const AUTH_USER_SELECT = {
  id: true,
  login: true,
  role: true,
  enabledExerciseTypes: true,
  dailyGenerationLimit: true,
  dailySuggestionsLimit: true,
  quotaDate: true,
  generationsCount: true,
  suggestionsCount: true,
} as const

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(input: LoginInput): Promise<CreatedSession | null> {
    const normalizedLogin = normalizeLogin(input.login)
    const user = await this.prisma.user.findUnique({
      where: { normalizedLogin },
      select: {
        ...AUTH_USER_SELECT,
        passwordHash: true,
      },
    })

    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password,
    )

    if (!user || !passwordMatches) {
      return null
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS)
    const token = randomBytes(32).toString('base64url')

    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      this.prisma.session.create({
        data: {
          tokenHash: hashToken(token),
          expiresAt,
          userId: user.id,
        },
      }),
    ])

    return {
      user: toAuthUser(user),
      token,
      expiresAt,
    }
  }

  async findUserByToken(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: AUTH_USER_SELECT,
        },
      },
    })

    if (!session) {
      return null
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } })
      return null
    }

    return toAuthUser(session.user)
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        enabledExerciseTypes: input.enabledExerciseTypes,
      },
      select: AUTH_USER_SELECT,
    })

    return toAuthUser(user)
  }

  async logout(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    })
  }
}

function toAuthUser(user: {
  id: string
  login: string
  role: AuthUser['role']
  enabledExerciseTypes: number[]
  dailyGenerationLimit: number | null
  dailySuggestionsLimit: number | null
  quotaDate: Date | null
  generationsCount: number
  suggestionsCount: number
}): AuthUser {
  return {
    id: user.id,
    login: user.login,
    role: user.role,
    enabledExerciseTypes: normalizeEnabledExerciseTypes(
      user.enabledExerciseTypes,
    ),
    canUseAiSuggestions: computeCanUseAiSuggestions(user),
  }
}

function normalizeLogin(login: string): string {
  return login.trim().normalize('NFKC').toLowerCase()
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password)
  } catch {
    return false
  }
}
