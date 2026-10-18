import { AppService } from './app.service.js'
import { PrismaService } from './prisma.service.js'

describe('AppService', () => {
  it('reads test records ordered by name', async () => {
    const findMany = vi
      .fn<
        (args: {
          orderBy: { name: 'asc' }
        }) => Promise<{ name: string; size: number }[]>
      >()
      .mockResolvedValue([
        { name: 'Alpha', size: 10 },
        { name: 'Beta', size: 20 },
      ])
    const prisma = {
      test: {
        findMany,
      },
    } as unknown as PrismaService
    const service = new AppService(prisma)

    await expect(service.getTests()).resolves.toEqual([
      { name: 'Alpha', size: 10 },
      { name: 'Beta', size: 20 },
    ])
    expect(findMany).toHaveBeenCalledWith({
      orderBy: {
        name: 'asc',
      },
    })
  })
})
