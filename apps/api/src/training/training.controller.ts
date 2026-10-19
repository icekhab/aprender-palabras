import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common'
import type {
  DailyTrainingTodayResponse,
  TrainerSessionResponse,
} from '@aprender-palabras/contracts'
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

  @Get('trainers/:id')
  getTrainerSession(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrainerSessionResponse> {
    return this.trainingService.getTrainerSession(request.authUser.id, id)
  }
}
