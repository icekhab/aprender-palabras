import { Module } from '@nestjs/common'
import { WordsModule } from '../words/words.module.js'
import { AdminWordsController } from './admin-words.controller.js'

@Module({
  imports: [WordsModule],
  controllers: [AdminWordsController],
})
export class AdminModule {}
