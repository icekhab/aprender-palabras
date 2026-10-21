import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import {
  addExistingWordSchema,
  dictionaryListQuerySchema,
  wordDraftSchema,
  wordPairSchema,
  type DictionaryListItem,
  type DictionaryListResponse,
  type UserCardDetail,
  type Word,
  type WordDraft,
} from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { WordsService } from './words.service.js'

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ): Promise<DictionaryListResponse> {
    const result = dictionaryListQuerySchema.safeParse(query)
    if (!result.success) {
      throw new BadRequestException('Invalid dictionary list query')
    }

    return this.wordsService.list(request.authUser.id, result.data)
  }

  @Get(':cardId')
  getCard(
    @Req() request: AuthenticatedRequest,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<UserCardDetail> {
    return this.wordsService.getCard(request.authUser.id, cardId)
  }

  @Post(':cardId/reset-progress')
  resetProgress(
    @Req() request: AuthenticatedRequest,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<UserCardDetail> {
    return this.wordsService.resetProgress(request.authUser.id, cardId)
  }

  @Delete(':cardId')
  @HttpCode(204)
  deleteCard(
    @Req() request: AuthenticatedRequest,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<void> {
    return this.wordsService.deleteCard(request.authUser.id, cardId)
  }

  @Post('preview')
  preview(@Body() body: unknown): Promise<WordDraft> {
    const result = wordPairSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word pair')
    }

    return this.wordsService.preview(result.data)
  }

  @Post('existing')
  addExisting(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<DictionaryListItem> {
    const result = addExistingWordSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word id')
    }

    return this.wordsService.addExisting(
      request.authUser.id,
      result.data.wordId,
    )
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<Word> {
    const result = wordDraftSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word draft')
    }

    return this.wordsService.create(request.authUser.id, result.data)
  }
}
