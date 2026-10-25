import { createHash, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { AuthUser, LoginInput } from '@aprender-palabras/contracts'
import argon2 from 'argon2'
import { PrismaService } from '../prisma.service.js'
import { SESSION_DURATION_MS } from './auth.constants.js'

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw'

interface CreatedSession {
  user: AuthUser
  token: string
  expiresAt: Date
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(input: LoginInput): Promise<CreatedSession | null> {
    const normalizedLogin = normalizeLogin(input.login)
    const user = await this.prisma.user.findUnique({
      where: { normalizedLogin },
      select: {
        id: true,
        login: true,
        role: true,
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
      user: { id: user.id, login: user.login, role: user.role },
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
          select: {
            id: true,
            login: true,
            role: true,
          },
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

    return session.user
  }

  async logout(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    })
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
