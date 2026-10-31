import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import type {
  AdminWordDetail,
  AdminWordsListQuery,
  AdminWordsListResponse,
  DictionaryListItem,
  DictionaryListQuery,
  DictionaryListResponse,
  RegeneratedWordImage,
  RegenerateWordImageInput,
  UpdateWordCardInput,
  UserCardDetail,
  UserRole,
  Word,
  WordDraft,
  WordPairInput,
} from '@aprender-palabras/contracts'
import { Prisma } from '../generated/prisma/client.js'
import { OpenAiService } from '../integrations/openai/openai.service.js'
import { UnsplashService } from '../integrations/unsplash/unsplash.service.js'
import { getMissingTrainerFields } from '../lessons/lesson-readiness.js'
import { PrismaService } from '../prisma.service.js'
import { QuotaService } from '../quotas/quota.service.js'
import { WordAudioService } from '../speech/word-audio.service.js'
import { canEditWord } from './word-edit-access.js'
import { normalizeWordKey } from './word-normalize.js'

@Injectable()
export class WordsService {
  private readonly logger = new Logger(WordsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly unsplashService: UnsplashService,
    private readonly wordAudioService: WordAudioService,
    private readonly quotaService: QuotaService,
  ) {}

  async preview(userId: string, input: WordPairInput): Promise<WordDraft> {
    const spanish = input.spanish.trim()
    const russian = input.russian.trim()
    const emptyDraft = emptyWordDraft(spanish, russian)

    if (!this.openAiService.isConfigured()) {
      return emptyDraft
    }

    await this.quotaService.consumeGeneration(userId)

    try {
      const content = await this.openAiService.generateWordContent(
        spanish,
        russian,
      )
      const image = await this.unsplashService.searchImage(content.unsplashQuery)

      return {
        spanish,
        russian,
        additionalTranslations: content.additionalTranslations,
        definitionEs: content.definitionEs,
        examples: content.examples,
        partOfSpeech: content.partOfSpeech,
        gender: content.gender,
        wrongRussian: content.wrongRussian,
        wrongSpanish: content.wrongSpanish,
        imageUrl: image?.imageUrl ?? null,
        imagePhotographerName: image?.imagePhotographerName ?? null,
        imagePhotographerUrl: image?.imagePhotographerUrl ?? null,
        imagePageUrl: image?.imagePageUrl ?? null,
        imageProvider: image?.imageProvider ?? null,
        imageDownloadLocation: image?.imageDownloadLocation ?? null,
      }
    } catch (error) {
      this.logger.error('Word preview generation failed', error)
      return emptyDraft
    }
  }

  async getCard(
    userId: string,
    role: UserRole,
    cardId: string,
  ): Promise<UserCardDetail> {
    const card = await this.prisma.userCard.findFirst({
      where: { id: cardId, userId },
      include: { word: true },
    })

    if (!card) {
      throw new NotFoundException('Card not found')
    }

    return this.toCardDetail(userId, role, card)
  }

  async resetProgress(
    userId: string,
    role: UserRole,
    cardId: string,
  ): Promise<UserCardDetail> {
    const existing = await this.prisma.userCard.findFirst({
      where: { id: cardId, userId },
      select: { id: true },
    })

    if (!existing) {
      throw new NotFoundException('Card not found')
    }

    const card = await this.prisma.userCard.update({
      where: { id: cardId },
      data: {
        progress: 0,
        lastTrainedAt: null,
        completedTrainerCount: 0,
        showCount: 0,
      },
      include: { word: true },
    })

    return this.toCardDetail(userId, role, card)
  }

  async deleteCard(userId: string, cardId: string): Promise<void> {
    const card = await this.prisma.userCard.findFirst({
      where: { id: cardId, userId },
      select: { id: true, wordId: true },
    })

    if (!card) {
      throw new NotFoundException('Card not found')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonWord.deleteMany({
        where: {
          wordId: card.wordId,
          lesson: { userId },
        },
      })
      await tx.userCard.delete({
        where: { id: card.id },
      })
    })
  }

  async updateCard(
    userId: string,
    role: UserRole,
    cardId: string,
    input: UpdateWordCardInput,
  ): Promise<UserCardDetail> {
    const card = await this.prisma.userCard.findFirst({
      where: { id: cardId, userId },
      include: { word: true },
    })

    if (!card) {
      throw new NotFoundException('Card not found')
    }

    if (!canEditWord(role, userId, card.word)) {
      throw new ForbiddenException('No permission to edit this word')
    }

    if (normalizeWordKey(input.spanish) !== card.word.normalizedSpanish) {
      throw new BadRequestException('Spanish text cannot be changed')
    }

    const russian = input.russian.trim()
    const normalizedRussian = normalizeWordKey(russian)
    const normalizedSpanish = card.word.normalizedSpanish
    const gender =
      input.partOfSpeech === 'sustantivo' ? input.gender : null

    if (normalizedRussian !== normalizeWordKey(card.word.russian)) {
      const conflict = await this.prisma.word.findUnique({
        where: {
          normalizedSpanish_normalizedRussian: {
            normalizedSpanish,
            normalizedRussian,
          },
        },
        select: { id: true },
      })

      if (conflict && conflict.id !== card.wordId) {
        throw new ConflictException('Word already exists')
      }
    }

    try {
      await this.prisma.word.update({
        where: { id: card.wordId },
        data: {
          russian,
          normalizedRussian,
          definitionEs: input.definitionEs,
          examples: input.examples,
          partOfSpeech: input.partOfSpeech,
          gender,
          wrongRussian: input.wrongRussian,
          wrongSpanish: input.wrongSpanish,
          imageUrl: input.imageUrl,
          imagePhotographerName: input.imagePhotographerName,
          imagePhotographerUrl: input.imagePhotographerUrl,
          imagePageUrl: input.imagePageUrl,
          imageProvider: input.imageProvider,
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Word already exists')
      }

      throw error
    }

    if (
      input.imageProvider === 'unsplash' &&
      input.imageDownloadLocation &&
      input.imageUrl !== card.word.imageUrl
    ) {
      void this.unsplashService.trackDownload(input.imageDownloadLocation)
    }

    return this.getCard(userId, role, cardId)
  }

  async listAdminWords(
    query: AdminWordsListQuery,
  ): Promise<AdminWordsListResponse> {
    const where = query.q
      ? {
          OR: [
            { spanish: { contains: query.q, mode: 'insensitive' as const } },
            { russian: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [totalCount, matchedCount, words] = await Promise.all([
      this.prisma.word.count(),
      this.prisma.word.count({ where }),
      this.prisma.word.findMany({
        where,
        orderBy: { [query.sortBy]: 'desc' },
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          spanish: true,
          russian: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

    return {
      totalCount,
      hasMore: query.offset + words.length < matchedCount,
      items: words.map((word) => ({
        id: word.id,
        spanish: word.spanish,
        russian: word.russian,
        createdAt: word.createdAt.toISOString(),
        updatedAt: word.updatedAt.toISOString(),
      })),
    }
  }

  async getAdminWord(wordId: string): Promise<AdminWordDetail> {
    const word = await this.prisma.word.findUnique({
      where: { id: wordId },
    })

    if (!word) {
      throw new NotFoundException('Word not found')
    }

    return toAdminWordDetail(word)
  }

  async createAdminWord(
    userId: string,
    draft: WordDraft,
  ): Promise<AdminWordDetail> {
    const spanish = draft.spanish.trim()
    const russian = draft.russian.trim()
    const normalizedSpanish = normalizeWordKey(spanish)
    const normalizedRussian = normalizeWordKey(russian)

    const existing = await this.prisma.word.findUnique({
      where: {
        normalizedSpanish_normalizedRussian: {
          normalizedSpanish,
          normalizedRussian,
        },
      },
      select: { id: true },
    })

    if (existing) {
      throw new ConflictException({
        message: 'Word already exists',
        wordId: existing.id,
      })
    }

    try {
      const word = await this.prisma.word.create({
        data: {
          spanish,
          russian,
          normalizedSpanish,
          normalizedRussian,
          additionalTranslations: draft.additionalTranslations,
          definitionEs: draft.definitionEs,
          examples: draft.examples,
          partOfSpeech: draft.partOfSpeech,
          gender: draft.gender,
          wrongRussian: draft.wrongRussian,
          wrongSpanish: draft.wrongSpanish,
          imageUrl: draft.imageUrl,
          imagePhotographerName: draft.imagePhotographerName,
          imagePhotographerUrl: draft.imagePhotographerUrl,
          imagePageUrl: draft.imagePageUrl,
          imageProvider: draft.imageProvider,
          imageGenerationCount: draft.imageUrl ? 1 : 0,
          createdByUserId: userId,
          createdViaLesson: false,
        },
      })

      if (
        draft.imageProvider === 'unsplash' &&
        draft.imageDownloadLocation
      ) {
        void this.unsplashService.trackDownload(draft.imageDownloadLocation)
      }

      await this.wordAudioService.ensureWordAudio(word.id)

      return toAdminWordDetail(word)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const conflict = await this.prisma.word.findUnique({
          where: {
            normalizedSpanish_normalizedRussian: {
              normalizedSpanish,
              normalizedRussian,
            },
          },
          select: { id: true },
        })

        throw new ConflictException({
          message: 'Word already exists',
          wordId: conflict?.id,
        })
      }

      throw error
    }
  }

  async updateAdminWord(
    wordId: string,
    input: UpdateWordCardInput,
  ): Promise<AdminWordDetail> {
    const word = await this.prisma.word.findUnique({
      where: { id: wordId },
    })

    if (!word) {
      throw new NotFoundException('Word not found')
    }

    if (normalizeWordKey(input.spanish) !== word.normalizedSpanish) {
      throw new BadRequestException('Spanish text cannot be changed')
    }

    const russian = input.russian.trim()
    const normalizedRussian = normalizeWordKey(russian)
    const gender = input.partOfSpeech === 'sustantivo' ? input.gender : null

    if (normalizedRussian !== normalizeWordKey(word.russian)) {
      const conflict = await this.prisma.word.findUnique({
        where: {
          normalizedSpanish_normalizedRussian: {
            normalizedSpanish: word.normalizedSpanish,
            normalizedRussian,
          },
        },
        select: { id: true },
      })

      if (conflict && conflict.id !== word.id) {
        throw new ConflictException('Word already exists')
      }
    }

    try {
      const updated = await this.prisma.word.update({
        where: { id: wordId },
        data: {
          russian,
          normalizedRussian,
          definitionEs: input.definitionEs,
          examples: input.examples,
          partOfSpeech: input.partOfSpeech,
          gender,
          wrongRussian: input.wrongRussian,
          wrongSpanish: input.wrongSpanish,
          imageUrl: input.imageUrl,
          imagePhotographerName: input.imagePhotographerName,
          imagePhotographerUrl: input.imagePhotographerUrl,
          imagePageUrl: input.imagePageUrl,
          imageProvider: input.imageProvider,
        },
      })

      if (
        input.imageProvider === 'unsplash' &&
        input.imageDownloadLocation &&
        input.imageUrl !== word.imageUrl
      ) {
        void this.unsplashService.trackDownload(input.imageDownloadLocation)
      }

      return toAdminWordDetail(updated)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Word already exists')
      }

      throw error
    }
  }

  async regenerateImage(
    input: RegenerateWordImageInput,
  ): Promise<RegeneratedWordImage> {
    if (!this.openAiService.isConfigured() || !this.unsplashService.isConfigured()) {
      throw new ServiceUnavailableException('Image regeneration unavailable')
    }

    if (input.wordId) {
      await this.quotaService.consumeImageGeneration(input.wordId)
    }

    try {
      const unsplashQuery = await this.openAiService.generateUnsplashQuery(
        input.spanish.trim(),
        input.russian.trim(),
      )
      const image = await this.unsplashService.searchImage(unsplashQuery, {
        excludeImageUrl: input.excludeImageUrl,
        perPage: 10,
      })

      if (!image) {
        throw new ServiceUnavailableException('No image found')
      }

      return image
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof HttpException
      ) {
        throw error
      }

      this.logger.error('Word image regeneration failed', error)
      throw new ServiceUnavailableException('Image regeneration failed')
    }
  }

  private async toCardDetail(
    userId: string,
    role: UserRole,
    card: {
      id: string
      wordId: string
      progress: number
      inDictionary: boolean
      source: 'manual' | 'lesson'
      addedAt: Date
      word: {
        spanish: string
        russian: string
        additionalTranslations: string[]
        definitionEs: string | null
        examples: string[]
        partOfSpeech: string | null
        gender: 'masculine' | 'feminine' | null
        wrongRussian: string[]
        wrongSpanish: string[]
        imageUrl: string | null
        imagePhotographerName: string | null
        imagePhotographerUrl: string | null
        imagePageUrl: string | null
        imageProvider: 'unsplash' | null
        createdByUserId: string | null
        createdViaLesson: boolean
      }
    },
  ): Promise<UserCardDetail> {
    const lessons = await this.prisma.lessonWord.findMany({
      where: {
        wordId: card.wordId,
        lesson: {
          course: {
            memberships: {
              some: {
                userId,
                status: 'accepted',
              },
            },
          },
        },
      },
      select: {
        lesson: {
          select: { id: true, title: true, courseId: true },
        },
      },
      orderBy: { lesson: { position: 'asc' } },
    })

    const missingFields = getMissingTrainerFields(card.word)

    return {
      id: card.id,
      wordId: card.wordId,
      spanish: card.word.spanish,
      russian: card.word.russian,
      additionalTranslations: card.word.additionalTranslations,
      definitionEs: card.word.definitionEs,
      examples: card.word.examples,
      partOfSpeech: card.word.partOfSpeech,
      gender: card.word.gender,
      wrongRussian: card.word.wrongRussian,
      wrongSpanish: card.word.wrongSpanish,
      imageUrl: card.word.imageUrl,
      imagePhotographerName: card.word.imagePhotographerName,
      imagePhotographerUrl: card.word.imagePhotographerUrl,
      imagePageUrl: card.word.imagePageUrl,
      imageProvider: card.word.imageProvider,
      progress: card.progress,
      inDictionary: card.inDictionary,
      source: card.source,
      addedAt: card.addedAt.toISOString(),
      ready: missingFields.length === 0,
      missingFields,
      canEdit: canEditWord(role, userId, card.word),
      lessons: lessons.map((item) => ({
        id: item.lesson.id,
        courseId: item.lesson.courseId,
        title: item.lesson.title,
      })),
    }
  }

  async list(
    userId: string,
    query: DictionaryListQuery,
  ): Promise<DictionaryListResponse> {
    const dictionaryWhere = {
      userId,
      inDictionary: true,
    }
    const listWhere = {
      ...dictionaryWhere,
      ...(query.q
        ? {
            word: {
              OR: [
                { spanish: { contains: query.q, mode: 'insensitive' as const } },
                { russian: { contains: query.q, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    }

    const [totalCount, progressAggregate, matchedCount, cards] =
      await Promise.all([
        this.prisma.userCard.count({ where: dictionaryWhere }),
        this.prisma.userCard.aggregate({
          where: dictionaryWhere,
          _avg: { progress: true },
        }),
        this.prisma.userCard.count({ where: listWhere }),
        this.prisma.userCard.findMany({
          where: listWhere,
          include: { word: true },
          orderBy: { addedAt: 'desc' },
          skip: query.offset,
          take: query.limit,
        }),
      ])

    const { _avg: averageFields } = progressAggregate
    const averageProgress =
      totalCount === 0 ? 0 : Math.round(averageFields.progress ?? 0)

    return {
      totalCount,
      averageProgress,
      hasMore: query.offset + cards.length < matchedCount,
      items: cards.map((card) => ({
        id: card.id,
        wordId: card.wordId,
        spanish: card.word.spanish,
        russian: card.word.russian,
        progress: card.progress,
        addedAt: card.addedAt.toISOString(),
      })),
    }
  }

  async addExisting(
    userId: string,
    wordId: string,
  ): Promise<DictionaryListItem> {
    const word = await this.prisma.word.findUnique({
      where: { id: wordId },
    })

    if (!word) {
      throw new NotFoundException('Word not found')
    }

    const existingCard = await this.prisma.userCard.findUnique({
      where: {
        userId_wordId: {
          userId,
          wordId,
        },
      },
    })

    if (existingCard) {
      throw new ConflictException('Word already exists')
    }

    try {
      const card = await this.prisma.userCard.create({
        data: {
          userId,
          wordId,
          source: 'manual',
          inDictionary: true,
          progress: 0,
        },
      })

      return {
        id: card.id,
        wordId: word.id,
        spanish: word.spanish,
        russian: word.russian,
        progress: card.progress,
        addedAt: card.addedAt.toISOString(),
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Word already exists')
      }

      throw error
    }
  }

  async create(userId: string, draft: WordDraft): Promise<Word> {
    const spanish = draft.spanish.trim()
    const russian = draft.russian.trim()
    const normalizedSpanish = normalizeWordKey(spanish)
    const normalizedRussian = normalizeWordKey(russian)

    try {
      const { word, createdNewWord } = await this.prisma.$transaction(
        async (tx) => {
          let existing = await tx.word.findUnique({
            where: {
              normalizedSpanish_normalizedRussian: {
                normalizedSpanish,
                normalizedRussian,
              },
            },
          })
          let wasCreated = false

          if (!existing) {
            try {
              existing = await tx.word.create({
                data: {
                  spanish,
                  russian,
                  normalizedSpanish,
                  normalizedRussian,
                  additionalTranslations: draft.additionalTranslations,
                  definitionEs: draft.definitionEs,
                  examples: draft.examples,
                  partOfSpeech: draft.partOfSpeech,
                  gender: draft.gender,
                  wrongRussian: draft.wrongRussian,
                  wrongSpanish: draft.wrongSpanish,
                  imageUrl: draft.imageUrl,
                  imagePhotographerName: draft.imagePhotographerName,
                  imagePhotographerUrl: draft.imagePhotographerUrl,
                  imagePageUrl: draft.imagePageUrl,
                  imageProvider: draft.imageProvider,
                  imageGenerationCount: draft.imageUrl ? 1 : 0,
                  createdByUserId: userId,
                  createdViaLesson: false,
                },
              })
              wasCreated = true
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
              ) {
                existing = await tx.word.findUniqueOrThrow({
                  where: {
                    normalizedSpanish_normalizedRussian: {
                      normalizedSpanish,
                      normalizedRussian,
                    },
                  },
                })
              } else {
                throw error
              }
            }
          }

          const existingCard = await tx.userCard.findUnique({
            where: {
              userId_wordId: {
                userId,
                wordId: existing.id,
              },
            },
          })

          if (existingCard) {
            throw new ConflictException('Word already exists')
          }

          await tx.userCard.create({
            data: {
              userId,
              wordId: existing.id,
              source: 'manual',
              inDictionary: true,
              progress: 0,
            },
          })

          return { word: existing, createdNewWord: wasCreated }
        },
      )

      if (
        createdNewWord &&
        draft.imageProvider === 'unsplash' &&
        draft.imageDownloadLocation
      ) {
        void this.unsplashService.trackDownload(draft.imageDownloadLocation)
      }

      if (createdNewWord) {
        await this.wordAudioService.ensureWordAudio(word.id)
      }

      return toWordResponse(word)
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Word already exists')
      }

      throw error
    }
  }
}

function emptyWordDraft(spanish: string, russian: string): WordDraft {
  return {
    spanish,
    russian,
    additionalTranslations: [],
    definitionEs: null,
    examples: [],
    partOfSpeech: null,
    gender: null,
    wrongRussian: [],
    wrongSpanish: [],
    imageUrl: null,
    imagePhotographerName: null,
    imagePhotographerUrl: null,
    imagePageUrl: null,
    imageProvider: null,
    imageDownloadLocation: null,
  }
}

function toWordResponse(word: {
  id: string
  spanish: string
  russian: string
  additionalTranslations: string[]
  definitionEs: string | null
  examples: string[]
  partOfSpeech: string | null
  gender: 'masculine' | 'feminine' | null
  wrongRussian: string[]
  wrongSpanish: string[]
  imageUrl: string | null
  imagePhotographerName: string | null
  imagePhotographerUrl: string | null
  imagePageUrl: string | null
  imageProvider: 'unsplash' | null
  createdAt: Date
  updatedAt: Date
}): Word {
  return {
    id: word.id,
    spanish: word.spanish,
    russian: word.russian,
    additionalTranslations: word.additionalTranslations,
    definitionEs: word.definitionEs,
    examples: word.examples,
    partOfSpeech: word.partOfSpeech,
    gender: word.gender,
    wrongRussian: word.wrongRussian,
    wrongSpanish: word.wrongSpanish,
    imageUrl: word.imageUrl,
    imagePhotographerName: word.imagePhotographerName,
    imagePhotographerUrl: word.imagePhotographerUrl,
    imagePageUrl: word.imagePageUrl,
    imageProvider: word.imageProvider,
    createdAt: word.createdAt.toISOString(),
    updatedAt: word.updatedAt.toISOString(),
  }
}

function toAdminWordDetail(word: {
  id: string
  spanish: string
  russian: string
  additionalTranslations: string[]
  definitionEs: string | null
  examples: string[]
  partOfSpeech: string | null
  gender: 'masculine' | 'feminine' | null
  wrongRussian: string[]
  wrongSpanish: string[]
  imageUrl: string | null
  imagePhotographerName: string | null
  imagePhotographerUrl: string | null
  imagePageUrl: string | null
  imageProvider: 'unsplash' | null
  createdAt: Date
  updatedAt: Date
}): AdminWordDetail {
  return {
    id: word.id,
    spanish: word.spanish,
    russian: word.russian,
    additionalTranslations: word.additionalTranslations,
    definitionEs: word.definitionEs,
    examples: word.examples,
    partOfSpeech: word.partOfSpeech,
    gender: word.gender,
    wrongRussian: word.wrongRussian,
    wrongSpanish: word.wrongSpanish,
    imageUrl: word.imageUrl,
    imagePhotographerName: word.imagePhotographerName,
    imagePhotographerUrl: word.imagePhotographerUrl,
    imagePageUrl: word.imagePageUrl,
    imageProvider: word.imageProvider,
    createdAt: word.createdAt.toISOString(),
    updatedAt: word.updatedAt.toISOString(),
  }
}
