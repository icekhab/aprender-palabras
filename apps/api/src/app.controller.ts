import { Controller, Get } from '@nestjs/common'
import type { HelloResponse } from '@aprender-palabras/contracts'
import { AppService } from './app.service.js'

@Controller('hello')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): HelloResponse {
    return this.appService.getHello()
  }
}
