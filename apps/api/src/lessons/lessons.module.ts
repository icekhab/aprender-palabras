import { Module } from '@nestjs/common'
import { CoursesModule } from '../courses/courses.module.js'
import { SpeechModule } from '../speech/speech.module.js'
import { LessonsController } from './lessons.controller.js'
import { LessonsService } from './lessons.service.js'

@Module({
  imports: [SpeechModule, CoursesModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
