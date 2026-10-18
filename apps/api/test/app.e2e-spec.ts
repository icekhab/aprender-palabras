import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from './../src/app.module.js'
import { AuthService } from './../src/auth/auth.service.js'
import { PrismaService } from './../src/prisma.service.js'

describe('AppController (e2e)', () => {
  let app: INestApplication
  const user = {
    id: '0199f98d-83c0-7bde-a537-b74cf7e9ea34',
    login: 'icekhab@gmail.com',
  }
  const authService = {
    login: vi.fn(async (input: { login: string; password: string }) =>
      input.login.toLowerCase() === user.login && input.password === '123345'
        ? {
            user,
            token: 'session-token',
            expiresAt: new Date(Date.now() + 60_000),
          }
        : null,
    ),
    findUserByToken: vi.fn(async (token: string) =>
      token === 'session-token' ? user : null,
    ),
    logout: vi.fn(async () => undefined),
  }

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        test: {
          findMany: vi
            .fn<() => Promise<{ name: string; size: number }[]>>()
            .mockResolvedValue([
              { name: 'Alpha', size: 10 },
              { name: 'Beta', size: 20 },
            ]),
        },
      })
      .overrideProvider(AuthService)
      .useValue(authService)
      .compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    await app.init()
  })

  it('logs in and sets a protected session cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        login: 'IceKhab@Gmail.com',
        password: '123345',
      })
      .expect(200)
      .expect(user)

    const cookie = response.headers['set-cookie']?.[0] as string
    expect(cookie).toContain('aprender_palabras_session=session-token')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
  })

  it('returns the same unauthorized response for invalid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        login: 'unknown@example.com',
        password: 'wrong',
      })
      .expect(401)

    expect(response.body).toEqual(
      expect.objectContaining({
        message: 'Invalid login or password',
      }),
    )
  })

  it('rejects a modifying request from an unknown origin', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'https://example.com')
      .send({
        login: user.login,
        password: '123345',
      })
      .expect(403)
  })

  it('protects API routes without a session', () => {
    return request(app.getHttpServer()).get('/api/tests').expect(401)
  })

  it('returns records for an authenticated session', () => {
    return request(app.getHttpServer())
      .get('/api/tests')
      .set('Cookie', 'aprender_palabras_session=session-token')
      .expect(200)
      .expect([
        { name: 'Alpha', size: 10 },
        { name: 'Beta', size: 20 },
      ])
  })

  it('returns the current user and logs out the current session', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'aprender_palabras_session=session-token')
      .expect(200)
      .expect(user)

    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'aprender_palabras_session=session-token')
      .expect(204)

    expect(authService.logout).toHaveBeenCalledWith('session-token')
    expect(response.headers['set-cookie']?.[0]).toContain(
      'aprender_palabras_session=;',
    )
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })
})
