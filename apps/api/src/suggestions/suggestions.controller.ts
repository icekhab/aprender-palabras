import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common'
import {
  suggestionsQuerySchema,
  type SuggestionsResponse,
} from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { SuggestionsService } from './suggestions.service.js'

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get()
  suggest(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ): Promise<SuggestionsResponse> {
    const result = suggestionsQuerySchema.safeParse(query)
    if (!result.success) {
      throw new BadRequestException('Invalid suggestion query')
    }

    return this.suggestionsService.suggest(
      request.authUser.id,
      result.data.q,
    )
  }
}
