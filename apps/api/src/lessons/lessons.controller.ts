import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import {
  addExistingWordSchema,
  createLessonSchema,
  lessonListQuerySchema,
  moveLessonSchema,
  removeLessonWordSchema,
  renameLessonSchema,
  setCurrentLessonSchema,
  updateWordCardSchema,
  type LessonDetail,
  type LessonListResponse,
  type LessonWordItem,
  type SetCurrentLessonPreview,
  type TrainingReadiness,
  type Word,
  type WordDraft,
} from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { LessonsService } from './lessons.service.js'

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ): Promise<LessonListResponse> {
    const result = lessonListQuerySchema.safeParse(query)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson list query')
    }

    return this.lessonsService.list(request.authUser.id, result.data)
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<LessonDetail> {
    const result = createLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson title')
    }

    return this.lessonsService.create(request.authUser.id, result.data)
  }

  @Post('current/preview')
  previewSetCurrent(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<SetCurrentLessonPreview> {
    const result = setCurrentLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson id')
    }

    return this.lessonsService.previewSetCurrent(
      request.authUser.id,
      result.data.lessonId,
    )
  }

  @Post('current')
  setCurrent(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<LessonDetail> {
    const result = setCurrentLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson id')
    }

    return this.lessonsService.setCurrent(
      request.authUser.id,
      result.data.lessonId,
    )
  }

  @Get(':id')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LessonDetail> {
    return this.lessonsService.getById(request.authUser.id, id)
  }

  @Patch(':id')
  rename(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<LessonDetail> {
    const result = renameLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson title')
    }

    return this.lessonsService.rename(
      request.authUser.id,
      id,
      result.data.title,
    )
  }

  @Post(':id/move')
  move(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<LessonDetail> {
    const result = moveLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid move direction')
    }

    return this.lessonsService.move(request.authUser.id, id, result.data)
  }

  @Delete(':id')
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.lessonsService.delete(request.authUser.id, id)
    return { ok: true }
  }

  @Post(':id/words')
  addExistingWord(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<LessonWordItem> {
    const result = addExistingWordSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word id')
    }

    return this.lessonsService.addExistingWord(
      request.authUser.id,
      id,
      result.data.wordId,
    )
  }

  @Post(':id/words/new')
  addNewWord(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
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

    return this.lessonsService.addNewWord(request.authUser.id, id, draft)
  }

  @Delete(':id/words/:wordId')
  removeWord(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wordId', ParseUUIDPipe) wordId: string,
    @Body() body: unknown,
  ): Promise<{ requiresDisposition: boolean }> {
    const result = removeLessonWordSchema.safeParse(body ?? {})
    if (!result.success) {
      throw new BadRequestException('Invalid disposition')
    }

    return this.lessonsService.removeWord(
      request.authUser.id,
      id,
      wordId,
      result.data,
    )
  }

  @Get(':id/training/readiness')
  trainingReadiness(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrainingReadiness> {
    return this.lessonsService.trainingReadiness(request.authUser.id, id)
  }
}
