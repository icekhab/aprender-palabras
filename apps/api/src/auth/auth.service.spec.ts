import { createHash } from 'node:crypto'
import { AuthService } from './auth.service.js'
import { PrismaService } from '../prisma.service.js'

const USER = {
  id: '0199f98d-83c0-7bde-a537-b74cf7e9ea34',
  login: 'icekhab@gmail.com',
  passwordHash:
    '$argon2id$v=19$m=65536,p=4,t=3$wTLVO0Cauibw5R0IToCucA$yHJsCfkeaFsmmTing4GbW+UhACxdLSYFcuw4gmaV+Kw',
}

type UserFindUnique = (args: {
  where: { normalizedLogin: string }
  select: Record<string, boolean>
}) => Promise<typeof USER | null>

type SessionCreate = (args: {
  data: {
    tokenHash: string
    expiresAt: Date
    userId: string
  }
}) => Promise<object>

function createPrismaMock() {
  const mock = {
    user: {
      findUnique: vi.fn<UserFindUnique>(),
    },
    session: {
      create: vi.fn<SessionCreate>().mockResolvedValue({}),
      delete: vi.fn<(args: unknown) => Promise<object>>().mockResolvedValue({}),
      deleteMany: vi
        .fn<(args: unknown) => Promise<{ count: number }>>()
        .mockResolvedValue({ count: 0 }),
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    $transaction: vi
      .fn<(operations: Promise<unknown>[]) => Promise<unknown[]>>()
      .mockImplementation((operations) => Promise.all(operations)),
  }

  return mock
}

describe('AuthService', () => {
  it('normalizes login and stores only a hash of the session token', async () => {
    const prisma = createPrismaMock()
    prisma.user.findUnique.mockResolvedValue(USER)
    const service = new AuthService(prisma as unknown as PrismaService)

    const session = await service.login({
      login: '  IceKhab@GMAIL.COM ',
      password: '123345',
    })

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { normalizedLogin: 'icekhab@gmail.com' },
      }),
    )
    expect(session?.user).toEqual({
      id: USER.id,
      login: USER.login,
    })
    expect(session?.token).toMatch(/^[\w-]{43}$/)

    const createCall = prisma.session.create.mock.calls[0]?.[0]
    expect(createCall.data.tokenHash).toBe(
      createHash('sha256').update(session!.token).digest('hex'),
    )
    expect(createCall.data.tokenHash).not.toContain(session!.token)
  })

  it('returns null and does not create a session for an invalid password', async () => {
    const prisma = createPrismaMock()
    prisma.user.findUnique.mockResolvedValue(USER)
    const service = new AuthService(prisma as unknown as PrismaService)

    await expect(
      service.login({
        login: USER.login,
        password: 'wrong',
      }),
    ).resolves.toBeNull()
    expect(prisma.session.create).not.toHaveBeenCalled()
  })

  it('deletes an expired session and rejects it', async () => {
    const prisma = createPrismaMock()
    prisma.session.findUnique.mockResolvedValue({
      id: 'expired-session',
      expiresAt: new Date(Date.now() - 1),
      user: {
        id: USER.id,
        login: USER.login,
      },
    })
    const service = new AuthService(prisma as unknown as PrismaService)

    await expect(service.findUserByToken('expired')).resolves.toBeNull()
    expect(prisma.session.delete).toHaveBeenCalledWith({
      where: { id: 'expired-session' },
    })
  })
})
