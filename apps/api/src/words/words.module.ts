import { Module } from '@nestjs/common'
import { OpenAiModule } from '../integrations/openai/openai.module.js'
import { UnsplashModule } from '../integrations/unsplash/unsplash.module.js'
import { SpeechModule } from '../speech/speech.module.js'
import { WordsController } from './words.controller.js'
import { WordsService } from './words.service.js'

@Module({
  imports: [OpenAiModule, UnsplashModule, SpeechModule],
  controllers: [WordsController],
  providers: [WordsService],
  exports: [WordsService],
})
export class WordsModule {}
