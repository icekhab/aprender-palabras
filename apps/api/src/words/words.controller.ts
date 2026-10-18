import { BadRequestException, Body, Controller, Post } from '@nestjs/common'
import {
  wordDraftSchema,
  wordPairSchema,
  type Word,
  type WordDraft,
} from '@aprender-palabras/contracts'
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
  create(@Body() body: unknown): Promise<Word> {
    const result = wordDraftSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word draft')
    }

    return this.wordsService.create(result.data)
  }
}
