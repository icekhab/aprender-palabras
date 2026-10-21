/* Position rewrites must run sequentially to satisfy unique (userId, position)
   / (lessonId, position) constraints. */
/* oxlint-disable no-await-in-loop */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  CreateLessonInput,
  LessonDetail,
  LessonListItem,
  LessonListQuery,
  LessonListResponse,
  LessonStatus,
  LessonWordItem,
  MoveLessonInput,
  RemoveLessonWordInput,
  SetCurrentLessonPreview,
  TrainingReadiness,
  Word,
  WordDraft,
} from '@aprender-palabras/contracts'
import { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma.service.js'
import { normalizeWordKey } from '../words/word-normalize.js'
import {
  getMissingTrainerFields,
  isWordReadyForTrainer,
} from './lesson-readiness.js'

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: LessonListQuery,
  ): Promise<LessonListResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentLessonId: true },
    })

    const [totalCount, lessons] = await Promise.all([
      this.prisma.lesson.count({ where: { userId } }),
      this.prisma.lesson.findMany({
        where: { userId },
        orderBy: { position: 'asc' },
        skip: query.offset,
        take: query.limit,
        include: {
          words: {
            include: { word: true },
          },
        },
      }),
    ])

    const wordIds = [
      ...new Set(lessons.flatMap((lesson) => lesson.words.map((w) => w.wordId))),
    ]
    const cards = await this.loadUserCards(userId, wordIds)
    const currentPosition = await this.getCurrentPosition(
      userId,
      user.currentLessonId,
    )

    return {
      totalCount,
      hasMore: query.offset + lessons.length < totalCount,
      currentLessonId: user.currentLessonId,
      items: lessons.map((lesson) =>
        this.toListItem(lesson, cards, currentPosition, user.currentLessonId),
      ),
    }
  }

  async create(
    userId: string,
    input: CreateLessonInput,
  ): Promise<LessonDetail> {
    const title = input.title.trim()
    const aggregate = await this.prisma.lesson.aggregate({
      where: { userId },
      _max: { position: true },
    })
    const { _max: maxPosition } = aggregate
    const position = (maxPosition.position ?? 0) + 1

    const lesson = await this.prisma.lesson.create({
      data: {
        userId,
        title,
        position,
      },
      include: {
        words: {
          include: { word: true },
          orderBy: { position: 'asc' },
        },
      },
    })

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentLessonId: true },
    })
    const currentPosition = await this.getCurrentPosition(
      userId,
      user.currentLessonId,
    )

    return this.toDetail(lesson, new Map(), currentPosition, user.currentLessonId)
  }

  async getById(userId: string, lessonId: string): Promise<LessonDetail> {
    const lesson = await this.findOwnedLesson(userId, lessonId)
    const cards = await this.loadUserCards(
      userId,
      lesson.words.map((item) => item.wordId),
    )
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentLessonId: true },
    })
    const currentPosition = await this.getCurrentPosition(
      userId,
      user.currentLessonId,
    )

    return this.toDetail(lesson, cards, currentPosition, user.currentLessonId)
  }

  async rename(
    userId: string,
    lessonId: string,
    title: string,
  ): Promise<LessonDetail> {
    await this.findOwnedLesson(userId, lessonId)
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { title: title.trim() },
    })
    return this.getById(userId, lessonId)
  }

  async move(
    userId: string,
    lessonId: string,
    input: MoveLessonInput,
  ): Promise<LessonDetail> {
    const lesson = await this.findOwnedLesson(userId, lessonId)
    const swapPosition =
      input.direction === 'up' ? lesson.position - 1 : lesson.position + 1

    const neighbor = await this.prisma.lesson.findUnique({
      where: {
        userId_position: {
          userId,
          position: swapPosition,
        },
      },
    })

    if (!neighbor) {
      throw new BadRequestException('Cannot move lesson further')
    }

    await this.prisma.$transaction(async (tx) => {
      const tempPosition = -lesson.position
      await tx.lesson.update({
        where: { id: lesson.id },
        data: { position: tempPosition },
      })
      await tx.lesson.update({
        where: { id: neighbor.id },
        data: { position: lesson.position },
      })
      await tx.lesson.update({
        where: { id: lesson.id },
        data: { position: neighbor.position },
      })
    })

    return this.getById(userId, lessonId)
  }

  async previewSetCurrent(
    userId: string,
    lessonId: string,
  ): Promise<SetCurrentLessonPreview> {
    const lesson = await this.findOwnedLesson(userId, lessonId)
    const next = await this.prisma.lesson.findUnique({
      where: {
        userId_position: {
          userId,
          position: lesson.position + 1,
        },
      },
    })

    const rangeLessons = await this.prisma.lesson.findMany({
      where: {
        userId,
        position: {
          lte: next ? next.position : lesson.position,
        },
      },
      include: {
        words: true,
      },
    })

    const wordIds = [
      ...new Set(
        rangeLessons.flatMap((item) => item.words.map((word) => word.wordId)),
      ),
    ]
    const cards = await this.loadUserCards(userId, wordIds)

    let wordsToAdd = 0
    let wordsAlreadyInDictionary = 0

    for (const wordId of wordIds) {
      const card = cards.get(wordId)
      if (card?.inDictionary) {
        wordsAlreadyInDictionary += 1
      } else {
        wordsToAdd += 1
      }
    }

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      nextLessonId: next?.id ?? null,
      nextLessonTitle: next?.title ?? null,
      wordsToAdd,
      wordsAlreadyInDictionary,
    }
  }

  async setCurrent(userId: string, lessonId: string): Promise<LessonDetail> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentLessonId: true },
    })

    if (user.currentLessonId === lessonId) {
      return this.getById(userId, lessonId)
    }

    const lesson = await this.findOwnedLesson(userId, lessonId)
    const next = await this.prisma.lesson.findUnique({
      where: {
        userId_position: {
          userId,
          position: lesson.position + 1,
        },
      },
    })

    await this.prisma.$transaction(async (tx) => {
      await this.transferRangeToDictionary(
        tx,
        userId,
        next ? next.position : lesson.position,
      )
      await tx.user.update({
        where: { id: userId },
        data: { currentLessonId: lessonId },
      })
    })

    return this.getById(userId, lessonId)
  }

  async delete(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.findOwnedLesson(userId, lessonId)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentLessonId: true },
    })

    const wasCurrent = user.currentLessonId === lessonId
    const previous =
      wasCurrent && lesson.position > 1
        ? await this.prisma.lesson.findUnique({
            where: {
              userId_position: {
                userId,
                position: lesson.position - 1,
              },
            },
          })
        : null

    await this.prisma.$transaction(async (tx) => {
      if (wasCurrent) {
        await tx.user.update({
          where: { id: userId },
          data: { currentLessonId: null },
        })
      }

      await tx.lesson.delete({ where: { id: lessonId } })

      const remaining = await tx.lesson.findMany({
        where: { userId },
        orderBy: { position: 'asc' },
      })

      for (const [index, item] of remaining.entries()) {
        await tx.lesson.update({
          where: { id: item.id },
          data: { position: -(index + 1) },
        })
      }

      for (const [index, item] of remaining.entries()) {
        await tx.lesson.update({
          where: { id: item.id },
          data: { position: index + 1 },
        })
      }

      if (wasCurrent && previous) {
        const updatedPrevious = await tx.lesson.findUniqueOrThrow({
          where: { id: previous.id },
        })
        const nextAfterPrevious = await tx.lesson.findUnique({
          where: {
            userId_position: {
              userId,
              position: updatedPrevious.position + 1,
            },
          },
        })
        await this.transferRangeToDictionary(
          tx,
          userId,
          nextAfterPrevious
            ? nextAfterPrevious.position
            : updatedPrevious.position,
        )
        await tx.user.update({
          where: { id: userId },
          data: { currentLessonId: previous.id },
        })
      }
    })
  }

  async addExistingWord(
    userId: string,
    lessonId: string,
    wordId: string,
  ): Promise<LessonWordItem> {
    const lesson = await this.findOwnedLesson(userId, lessonId)
    const addToDictionary = await this.isNextLesson(userId, lesson.position)

    const word = await this.prisma.word.findUnique({ where: { id: wordId } })
    if (!word) {
      throw new NotFoundException('Word not found')
    }

    const existingLink = await this.prisma.lessonWord.findUnique({
      where: {
        lessonId_wordId: {
          lessonId,
          wordId,
        },
      },
    })
    if (existingLink) {
      throw new ConflictException('Word already in lesson')
    }

    const aggregate = await this.prisma.lessonWord.aggregate({
      where: { lessonId },
      _max: { position: true },
    })
    const { _max: maxWordPosition } = aggregate
    const position = (maxWordPosition.position ?? 0) + 1

    const card = await this.prisma.userCard.findUnique({
      where: {
        userId_wordId: {
          userId,
          wordId,
        },
      },
    })

    try {
      const [lessonWord, ensuredCard] = await this.prisma.$transaction(
        async (tx) => {
          if (!card) {
            await tx.userCard.create({
              data: {
                userId,
                wordId,
                source: 'lesson',
                inDictionary: addToDictionary,
                progress: 0,
              },
            })
          } else if (addToDictionary && !card.inDictionary) {
            await tx.userCard.update({
              where: { id: card.id },
              data: { inDictionary: true },
            })
          }

          const created = await tx.lessonWord.create({
            data: {
              lessonId,
              wordId,
              position,
            },
          })

          const userCard = await tx.userCard.findUniqueOrThrow({
            where: {
              userId_wordId: {
                userId,
                wordId,
              },
            },
          })

          return [created, userCard] as const
        },
      )

      return {
        wordId: word.id,
        userCardId: ensuredCard.id,
        spanish: word.spanish,
        russian: word.russian,
        progress: ensuredCard.progress,
        inDictionary: ensuredCard.inDictionary,
        ready: isWordReadyForTrainer(word),
        missingFields: getMissingTrainerFields(word),
        position: lessonWord.position,
        addedAt: lessonWord.addedAt.toISOString(),
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Word already in lesson')
      }

      throw error
    }
  }

  async addNewWord(
    userId: string,
    lessonId: string,
    draft: WordDraft,
  ): Promise<Word> {
    const lesson = await this.findOwnedLesson(userId, lessonId)
    const addToDictionary = await this.isNextLesson(userId, lesson.position)

    const spanish = draft.spanish.trim()
    const russian = draft.russian.trim()
    const normalizedSpanish = normalizeWordKey(spanish)
    const normalizedRussian = normalizeWordKey(russian)

    try {
      const word = await this.prisma.$transaction(async (tx) => {
        let existing = await tx.word.findUnique({
          where: {
            normalizedSpanish_normalizedRussian: {
              normalizedSpanish,
              normalizedRussian,
            },
          },
        })

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
              },
            })
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

        const existingLink = await tx.lessonWord.findUnique({
          where: {
            lessonId_wordId: {
              lessonId,
              wordId: existing.id,
            },
          },
        })
        if (existingLink) {
          throw new ConflictException('Word already in lesson')
        }

        const existingCard = await tx.userCard.findUnique({
          where: {
            userId_wordId: {
              userId,
              wordId: existing.id,
            },
          },
        })

        if (!existingCard) {
          await tx.userCard.create({
            data: {
              userId,
              wordId: existing.id,
              source: 'lesson',
              inDictionary: addToDictionary,
              progress: 0,
            },
          })
        } else if (addToDictionary && !existingCard.inDictionary) {
          await tx.userCard.update({
            where: { id: existingCard.id },
            data: { inDictionary: true },
          })
        }

        const aggregate = await tx.lessonWord.aggregate({
          where: { lessonId },
          _max: { position: true },
        })
        const { _max: maxNewWordPosition } = aggregate

        await tx.lessonWord.create({
          data: {
            lessonId,
            wordId: existing.id,
            position: (maxNewWordPosition.position ?? 0) + 1,
          },
        })

        return existing
      })

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
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Word already in lesson')
      }

      throw error
    }
  }

  async removeWord(
    userId: string,
    lessonId: string,
    wordId: string,
    input: RemoveLessonWordInput,
  ): Promise<{ requiresDisposition: boolean }> {
    await this.findOwnedLesson(userId, lessonId)

    const link = await this.prisma.lessonWord.findUnique({
      where: {
        lessonId_wordId: {
          lessonId,
          wordId,
        },
      },
    })
    if (!link) {
      throw new NotFoundException('Word not in lesson')
    }

    const card = await this.prisma.userCard.findUnique({
      where: {
        userId_wordId: {
          userId,
          wordId,
        },
      },
    })

    const otherLinks = await this.prisma.lessonWord.count({
      where: {
        wordId,
        lesson: { userId },
        NOT: { lessonId },
      },
    })

    const needsDisposition =
      Boolean(card) &&
      card !== null &&
      !card.inDictionary &&
      otherLinks === 0 &&
      !input.disposition

    if (needsDisposition) {
      return { requiresDisposition: true }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonWord.delete({ where: { id: link.id } })

      const remaining = await tx.lessonWord.findMany({
        where: { lessonId },
        orderBy: { position: 'asc' },
      })

      for (const [index, item] of remaining.entries()) {
        await tx.lessonWord.update({
          where: { id: item.id },
          data: { position: -(index + 1) },
        })
      }

      for (const [index, item] of remaining.entries()) {
        await tx.lessonWord.update({
          where: { id: item.id },
          data: { position: index + 1 },
        })
      }

      if (
        card &&
        !card.inDictionary &&
        otherLinks === 0 &&
        input.disposition === 'keep_dictionary'
      ) {
        await tx.userCard.update({
          where: { id: card.id },
          data: {
            inDictionary: true,
            source: 'manual',
          },
        })
      }

      if (
        card &&
        !card.inDictionary &&
        otherLinks === 0 &&
        input.disposition === 'delete_card'
      ) {
        await tx.userCard.delete({ where: { id: card.id } })
      }
    })

    return { requiresDisposition: false }
  }

  async trainingReadiness(
    userId: string,
    lessonId: string,
  ): Promise<TrainingReadiness> {
    const lesson = await this.findOwnedLesson(userId, lessonId)
    const missingByWord = lesson.words
      .map((item) => {
        const missingFields = getMissingTrainerFields(item.word)
        return {
          wordId: item.wordId,
          spanish: item.word.spanish,
          russian: item.word.russian,
          missingFields,
        }
      })
      .filter((item) => item.missingFields.length > 0)

    const readyCount = lesson.words.length - missingByWord.length

    return {
      readyCount,
      canStart: readyCount >= 4,
      missingByWord,
      trainerAvailable: false,
    }
  }

  private async transferRangeToDictionary(
    tx: Prisma.TransactionClient,
    userId: string,
    maxPositionInclusive: number,
  ): Promise<void> {
    const lessons = await tx.lesson.findMany({
      where: {
        userId,
        position: { lte: maxPositionInclusive },
      },
      include: { words: true },
    })

    const wordIds = [
      ...new Set(
        lessons.flatMap((lesson) => lesson.words.map((word) => word.wordId)),
      ),
    ]

    for (const wordId of wordIds) {
      const card = await tx.userCard.findUnique({
        where: {
          userId_wordId: {
            userId,
            wordId,
          },
        },
      })

      if (card) {
        if (!card.inDictionary) {
          await tx.userCard.update({
            where: { id: card.id },
            data: { inDictionary: true },
          })
        }
      } else {
        await tx.userCard.create({
          data: {
            userId,
            wordId,
            source: 'lesson',
            inDictionary: true,
            progress: 0,
          },
        })
      }
    }
  }

  private async findOwnedLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, userId },
      include: {
        words: {
          include: { word: true },
          orderBy: { position: 'asc' },
        },
      },
    })

    if (!lesson) {
      throw new NotFoundException('Lesson not found')
    }

    return lesson
  }

  private async loadUserCards(
    userId: string,
    wordIds: string[],
  ): Promise<
    Map<
      string,
      {
        id: string
        progress: number
        inDictionary: boolean
      }
    >
  > {
    if (wordIds.length === 0) {
      return new Map()
    }

    const cards = await this.prisma.userCard.findMany({
      where: {
        userId,
        wordId: { in: wordIds },
      },
    })

    return new Map(
      cards.map((card) => [
        card.wordId,
        {
          id: card.id,
          progress: card.progress,
          inDictionary: card.inDictionary,
        },
      ]),
    )
  }

  private async isNextLesson(
    userId: string,
    lessonPosition: number,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentLessonId: true },
    })
    const currentPosition = await this.getCurrentPosition(
      userId,
      user.currentLessonId,
    )

    return (
      this.resolveStatus(
        lessonPosition,
        currentPosition,
        user.currentLessonId,
      ) === 'next'
    )
  }

  private async getCurrentPosition(
    userId: string,
    currentLessonId: string | null,
  ): Promise<number | null> {
    if (!currentLessonId) {
      return null
    }

    const current = await this.prisma.lesson.findFirst({
      where: { id: currentLessonId, userId },
      select: { position: true },
    })

    return current?.position ?? null
  }

  private resolveStatus(
    position: number,
    currentPosition: number | null,
    currentLessonId: string | null,
  ): LessonStatus {
    if (!currentLessonId || currentPosition === null) {
      return 'undefined'
    }

    if (position === currentPosition) {
      return 'current'
    }

    if (position < currentPosition) {
      return 'previous'
    }

    if (position === currentPosition + 1) {
      return 'next'
    }

    return 'future'
  }

  private toListItem(
    lesson: {
      id: string
      title: string
      position: number
      createdAt: Date
      words: Array<{
        wordId: string
        word: {
          spanish: string
          russian: string
          wrongRussian: string[]
          wrongSpanish: string[]
        }
      }>
    },
    cards: Map<string, { id: string; progress: number; inDictionary: boolean }>,
    currentPosition: number | null,
    currentLessonId: string | null,
  ): LessonListItem {
    const progressValues = lesson.words.map(
      (item) => cards.get(item.wordId)?.progress ?? 0,
    )
    const averageProgress =
      progressValues.length === 0
        ? 0
        : Math.round(
            progressValues.reduce((sum, value) => sum + value, 0) /
              progressValues.length,
          )
    const readyCount = lesson.words.filter((item) =>
      isWordReadyForTrainer(item.word),
    ).length

    return {
      id: lesson.id,
      title: lesson.title,
      position: lesson.position,
      status: this.resolveStatus(
        lesson.position,
        currentPosition,
        currentLessonId,
      ),
      wordCount: lesson.words.length,
      readyCount,
      averageProgress,
      createdAt: lesson.createdAt.toISOString(),
    }
  }

  private toDetail(
    lesson: {
      id: string
      title: string
      position: number
      createdAt: Date
      words: Array<{
        wordId: string
        position: number
        addedAt: Date
        word: {
          spanish: string
          russian: string
          wrongRussian: string[]
          wrongSpanish: string[]
        }
      }>
    },
    cards: Map<string, { id: string; progress: number; inDictionary: boolean }>,
    currentPosition: number | null,
    currentLessonId: string | null,
  ): LessonDetail {
    const listItem = this.toListItem(
      lesson,
      cards,
      currentPosition,
      currentLessonId,
    )

    return {
      ...listItem,
      words: lesson.words.map((item) => {
        const card = cards.get(item.wordId)
        const missingFields = getMissingTrainerFields(item.word)
        return {
          wordId: item.wordId,
          userCardId: card?.id ?? null,
          spanish: item.word.spanish,
          russian: item.word.russian,
          progress: card?.progress ?? 0,
          inDictionary: card?.inDictionary ?? false,
          ready: missingFields.length === 0,
          missingFields,
          position: item.position,
          addedAt: item.addedAt.toISOString(),
        }
      }),
    }
  }
}
