import { Injectable } from '@nestjs/common'
import type { HelloResponse } from '@aprender-palabras/contracts'

@Injectable()
export class AppService {
  getHello(): HelloResponse {
    return {
      message: 'Hello world',
    }
  }
}
