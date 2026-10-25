import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import {
  addExistingWordSchema,
  dictionaryListQuerySchema,
  regenerateWordImageSchema,
  updateWordCardSchema,
  wordPairSchema,
  type DictionaryListItem,
  type DictionaryListResponse,
  type RegeneratedWordImage,
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

  @Post('image/regenerate')
  regenerateImage(@Body() body: unknown): Promise<RegeneratedWordImage> {
    const result = regenerateWordImageSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid image regeneration request')
    }

    return this.wordsService.regenerateImage(result.data)
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<Word> {
    const result = updateWordCardSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word draft')
    }

    const draft: WordDraft = {
      ...result.data,
      additionalTranslations: [],
    }

    return this.wordsService.create(request.authUser.id, draft)
  }

  @Get(':cardId')
  getCard(
    @Req() request: AuthenticatedRequest,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<UserCardDetail> {
    return this.wordsService.getCard(
      request.authUser.id,
      request.authUser.role,
      cardId,
    )
  }

  @Patch(':cardId')
  updateCard(
    @Req() request: AuthenticatedRequest,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() body: unknown,
  ): Promise<UserCardDetail> {
    const result = updateWordCardSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word card update')
    }

    return this.wordsService.updateCard(
      request.authUser.id,
      request.authUser.role,
      cardId,
      result.data,
    )
  }

  @Post(':cardId/reset-progress')
  resetProgress(
    @Req() request: AuthenticatedRequest,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<UserCardDetail> {
    return this.wordsService.resetProgress(
      request.authUser.id,
      request.authUser.role,
      cardId,
    )
  }

  @Delete(':cardId')
  @HttpCode(204)
  deleteCard(
    @Req() request: AuthenticatedRequest,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<void> {
    return this.wordsService.deleteCard(request.authUser.id, cardId)
  }
}
