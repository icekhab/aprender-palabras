import { Module } from '@nestjs/common'
import { TrainingModule } from '../training/training.module.js'
import { WordsModule } from '../words/words.module.js'
import { CollectionsController } from './collections.controller.js'
import { CollectionsService } from './collections.service.js'

@Module({
  imports: [WordsModule, TrainingModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
