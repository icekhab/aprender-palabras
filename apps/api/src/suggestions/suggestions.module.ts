import { Module } from '@nestjs/common'
import { OpenAiModule } from '../integrations/openai/openai.module.js'
import { QuotasModule } from '../quotas/quotas.module.js'
import { SuggestionsController } from './suggestions.controller.js'
import { SuggestionsService } from './suggestions.service.js'

@Module({
  imports: [OpenAiModule, QuotasModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService],
})
export class SuggestionsModule {}
