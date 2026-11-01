import { Module } from '@nestjs/common'
import { WordsModule } from '../words/words.module.js'
import { CollectionsController } from './collections.controller.js'
import { CollectionsService } from './collections.service.js'

@Module({
  imports: [WordsModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
