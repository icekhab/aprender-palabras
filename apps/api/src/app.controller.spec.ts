import { Test, TestingModule } from '@nestjs/testing'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'

describe('AppController', () => {
  let appController: AppController
  const tests = [
    { name: 'Alpha', size: 10 },
    { name: 'Beta', size: 20 },
  ]

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getTests: vi
              .fn<() => Promise<typeof tests>>()
              .mockResolvedValue(tests),
          },
        },
      ],
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe('tests', () => {
    it('returns test records', async () => {
      await expect(appController.getTests()).resolves.toEqual(tests)
    })
  })
})
