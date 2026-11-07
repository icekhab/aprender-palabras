import { Module } from '@nestjs/common'
import { TrainingModule } from '../training/training.module.js'
import { CoursesController } from './courses.controller.js'
import { CoursesService } from './courses.service.js'

@Module({
  imports: [TrainingModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
