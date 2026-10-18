import { Controller, Get } from '@nestjs/common'
import type { TestsResponse } from '@aprender-palabras/contracts'
import { AppService } from './app.service.js'

@Controller('tests')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getTests(): Promise<TestsResponse> {
    return this.appService.getTests()
  }
}
