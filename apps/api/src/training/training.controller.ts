import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common'
import type {
  CompleteTrainerResponse,
  DailyTrainingTodayResponse,
  TrainerSessionResponse,
} from '@aprender-palabras/contracts'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { TrainingService } from './training.service.js'

const completeTrainerBodySchema = z.object({
  cards: z
    .array(
      z.object({
        userCardId: z.string().uuid(),
        errorCount: z.number().int().min(0).max(1000),
      }),
    )
    .min(1),
})

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

  @Post('trainers/:id/complete')
  completeTrainer(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<CompleteTrainerResponse> {
    const parsed = completeTrainerBodySchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('Invalid completion payload')
    }
    return this.trainingService.completeTrainer(
      request.authUser.id,
      id,
      parsed.data.cards,
    )
  }
}
