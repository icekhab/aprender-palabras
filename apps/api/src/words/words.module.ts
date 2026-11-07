import { Module } from '@nestjs/common'
import { OpenAiModule } from '../integrations/openai/openai.module.js'
import { UnsplashModule } from '../integrations/unsplash/unsplash.module.js'
import { QuotasModule } from '../quotas/quotas.module.js'
import { SpeechModule } from '../speech/speech.module.js'
import { TrainingModule } from '../training/training.module.js'
import { WordsController } from './words.controller.js'
import { WordsService } from './words.service.js'

@Module({
  imports: [
    OpenAiModule,
    UnsplashModule,
    SpeechModule,
    QuotasModule,
    TrainingModule,
  ],
  controllers: [WordsController],
  providers: [WordsService],
  exports: [WordsService],
})
export class WordsModule {}
