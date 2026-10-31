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
  UseGuards,
} from '@nestjs/common'
import {
  addExistingWordSchema,
  createLessonSchema,
  lessonListQuerySchema,
  moveLessonSchema,
  removeLessonWordSchema,
  renameLessonSchema,
  updateWordCardSchema,
  type LessonDetail,
  type LessonListResponse,
  type LessonWordItem,
  type TrainingReadiness,
  type Word,
  type WordDraft,
} from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { TeacherGuard } from '../auth/teacher.guard.js'
import { LessonsService } from './lessons.service.js'

@Controller('courses/:courseId/lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: unknown,
  ): Promise<LessonListResponse> {
    const result = lessonListQuerySchema.safeParse(query)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson list query')
    }

    return this.lessonsService.list(
      request.authUser.id,
      courseId,
      result.data,
    )
  }

  @Post()
  @UseGuards(TeacherGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() body: unknown,
  ): Promise<LessonDetail> {
    const result = createLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson title')
    }

    return this.lessonsService.create(
      request.authUser.id,
      courseId,
      result.data,
    )
  }

  @Get(':id')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LessonDetail> {
    return this.lessonsService.getById(request.authUser.id, courseId, id)
  }

  @Patch(':id')
  @UseGuards(TeacherGuard)
  rename(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<LessonDetail> {
    const result = renameLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson title')
    }

    return this.lessonsService.rename(
      request.authUser.id,
      courseId,
      id,
      result.data.title,
    )
  }

  @Post(':id/move')
  @UseGuards(TeacherGuard)
  move(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<LessonDetail> {
    const result = moveLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid move direction')
    }

    return this.lessonsService.move(
      request.authUser.id,
      courseId,
      id,
      result.data,
    )
  }

  @Delete(':id')
  @UseGuards(TeacherGuard)
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.lessonsService.delete(request.authUser.id, courseId, id)
    return { ok: true }
  }

  @Post(':id/words')
  @UseGuards(TeacherGuard)
  addExistingWord(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<LessonWordItem> {
    const result = addExistingWordSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid word id')
    }

    return this.lessonsService.addExistingWord(
      request.authUser.id,
      courseId,
      id,
      result.data.wordId,
    )
  }

  @Post(':id/words/new')
  @UseGuards(TeacherGuard)
  addNewWord(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
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

    return this.lessonsService.addNewWord(
      request.authUser.id,
      courseId,
      id,
      draft,
    )
  }

  @Delete(':id/words/:wordId')
  @UseGuards(TeacherGuard)
  removeWord(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
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
      courseId,
      id,
      wordId,
      result.data,
    )
  }

  @Get(':id/training/readiness')
  trainingReadiness(
    @Req() request: AuthenticatedRequest,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrainingReadiness> {
    return this.lessonsService.trainingReadiness(
      request.authUser.id,
      courseId,
      id,
    )
  }
}
