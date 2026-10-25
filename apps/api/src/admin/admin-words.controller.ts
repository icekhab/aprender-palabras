import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  adminWordsListQuerySchema,
  updateWordCardSchema,
  type AdminWordDetail,
  type AdminWordsListResponse,
  type WordDraft,
} from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { AdminGuard } from '../auth/admin.guard.js'
import { WordsService } from '../words/words.service.js'

@Controller('admin/words')
@UseGuards(AdminGuard)
export class AdminWordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  list(@Query() query: unknown): Promise<AdminWordsListResponse> {
    const result = adminWordsListQuerySchema.safeParse(query)
    if (!result.success) {
      throw new BadRequestException('Invalid admin words list query')
    }

    return this.wordsService.listAdminWords(result.data)
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<AdminWordDetail> {
    const result = updateWordCardSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word draft')
    }

    const draft: WordDraft = {
      ...result.data,
      additionalTranslations: [],
    }

    return this.wordsService.createAdminWord(request.authUser.id, draft)
  }

  @Get(':wordId')
  getWord(
    @Param('wordId', ParseUUIDPipe) wordId: string,
  ): Promise<AdminWordDetail> {
    return this.wordsService.getAdminWord(wordId)
  }

  @Patch(':wordId')
  updateWord(
    @Param('wordId', ParseUUIDPipe) wordId: string,
    @Body() body: unknown,
  ): Promise<AdminWordDetail> {
    const result = updateWordCardSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word update')
    }

    return this.wordsService.updateAdminWord(wordId, result.data)
  }
}
