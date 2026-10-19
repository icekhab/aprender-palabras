import { Controller, Get, Req } from '@nestjs/common'
import type { DailyTrainingTodayResponse } from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { TrainingService } from './training.service.js'

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('today')
  getToday(
    @Req() request: AuthenticatedRequest,
  ): Promise<DailyTrainingTodayResponse> {
    return this.trainingService.getToday(request.authUser.id)
  }
}
