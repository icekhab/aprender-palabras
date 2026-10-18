import { Injectable } from '@nestjs/common'
import type { TestsResponse } from '@aprender-palabras/contracts'
import { PrismaService } from './prisma.service.js'

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getTests(): Promise<TestsResponse> {
    return this.prisma.test.findMany({
      orderBy: {
        name: 'asc',
      },
    })
  }
}
