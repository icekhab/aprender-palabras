import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import {
  suggestionsQuerySchema,
  type SuggestionsResponse,
} from '@aprender-palabras/contracts'
import { SuggestionsService } from './suggestions.service.js'

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get()
  suggest(@Query() query: unknown): Promise<SuggestionsResponse> {
    const result = suggestionsQuerySchema.safeParse(query)
    if (!result.success) {
      throw new BadRequestException('Invalid suggestion query')
    }

    return this.suggestionsService.suggest(result.data.q)
  }
}
