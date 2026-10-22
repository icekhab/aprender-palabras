import { Module } from '@nestjs/common'
import { SpeechModule } from '../speech/speech.module.js'
import { TrainingController } from './training.controller.js'
import { TrainingService } from './training.service.js'

@Module({
  imports: [SpeechModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
