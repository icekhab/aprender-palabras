import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common'
import {
  wordDraftSchema,
  wordPairSchema,
  type Word,
  type WordDraft,
} from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { WordsService } from './words.service.js'

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Post('preview')
  preview(@Body() body: unknown): Promise<WordDraft> {
    const result = wordPairSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word pair')
    }

    return this.wordsService.preview(result.data)
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
