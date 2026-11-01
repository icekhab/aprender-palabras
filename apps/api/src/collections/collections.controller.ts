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
  UseGuards,
} from '@nestjs/common'
import {
  addWordToCollectionSchema,
  collectionsListQuerySchema,
  createWordCollectionSchema,
  setWordCollectionStatusSchema,
  updateWordCardSchema,
  updateWordCollectionSchema,
  type CreateCollectionTrainerResponse,
  type WordCollectionDetail,
  type WordCollectionListResponse,
  type WordDraft,
} from '@aprender-palabras/contracts'
import { AdminGuard } from '../auth/admin.guard.js'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { CollectionsService } from './collections.service.js'

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ): Promise<WordCollectionListResponse> {
    const parsed = collectionsListQuerySchema.safeParse(query ?? {})
    if (!parsed.success) {
      throw new BadRequestException('Invalid collections query')
    }
    return this.collectionsService.list(
      request.authUser.id,
      request.authUser.role,
      parsed.data.q,
    )
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<WordCollectionDetail> {
    const parsed = createWordCollectionSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('Invalid collection title')
    }
    return this.collectionsService.create(request.authUser.id, parsed.data)
  }

  @Get(':id')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WordCollectionDetail> {
    return this.collectionsService.getById(
      request.authUser.id,
      id,
      request.authUser.role,
    )
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WordCollectionDetail> {
    const parsed = updateWordCollectionSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('Invalid collection update')
    }
    return this.collectionsService.update(
      request.authUser.id,
      id,
      parsed.data,
    )
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  setStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WordCollectionDetail> {
    const parsed = setWordCollectionStatusSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('Invalid collection status')
    }
    return this.collectionsService.setStatus(
      request.authUser.id,
      id,
      parsed.data,
    )
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.collectionsService.remove(id)
  }

  @Post(':id/words')
  @UseGuards(AdminGuard)
  addWord(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WordCollectionDetail> {
    const parsed = addWordToCollectionSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('Invalid word id')
    }
    return this.collectionsService.addWord(
      request.authUser.id,
      id,
      parsed.data.wordId,
    )
  }

  @Post(':id/words/new')
  @UseGuards(AdminGuard)
  addNewWord(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WordCollectionDetail> {
    const parsed = updateWordCardSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('Invalid word draft')
    }
    const draft: WordDraft = {
      ...parsed.data,
      additionalTranslations: [],
    }
    return this.collectionsService.addNewWord(
      request.authUser.id,
      id,
      draft,
    )
  }

  @Delete(':id/words/:wordId')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  async removeWord(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wordId', ParseUUIDPipe) wordId: string,
  ): Promise<void> {
    await this.collectionsService.removeWord(id, wordId)
  }

  @Post(':id/add')
  addForUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WordCollectionDetail> {
    return this.collectionsService.addForUser(request.authUser.id, id)
  }

  @Delete(':id/add')
  @HttpCode(204)
  async removeForUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.collectionsService.removeForUser(request.authUser.id, id)
  }

  @Post(':id/trainers')
  createTrainer(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CreateCollectionTrainerResponse> {
    return this.collectionsService.createTrainer(request.authUser.id, id)
  }
}
