import { Module } from '@nestjs/common'
import { SpeechModule } from '../speech/speech.module.js'
import { LessonsController } from './lessons.controller.js'
import { LessonsService } from './lessons.service.js'

@Module({
  imports: [SpeechModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
