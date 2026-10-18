import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from './../src/app.module.js'
import { PrismaService } from './../src/prisma.service.js'

describe('AppController (e2e)', () => {
  let app: INestApplication

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
      .compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  it('/api/tests (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/tests')
      .expect(200)
      .expect([
        { name: 'Alpha', size: 10 },
        { name: 'Beta', size: 20 },
      ])
  })

  afterEach(async () => {
    await app.close()
  })
})
