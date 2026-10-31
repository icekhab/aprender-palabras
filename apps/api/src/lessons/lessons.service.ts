/* Position rewrites must run sequentially to satisfy unique (courseId, position)
   / (lessonId, position) constraints. */
/* oxlint-disable no-await-in-loop */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  TrainingReadiness,
  Word,
  WordDraft,
} from '@aprender-palabras/contracts'
import { isEffectivelyActive } from '../courses/course-access.js'
import { CoursesService } from '../courses/courses.service.js'
import { UnsplashService } from '../integrations/unsplash/unsplash.service.js'
import { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma.service.js'
import { WordAudioService } from '../speech/word-audio.service.js'
import { normalizeWordKey } from '../words/word-normalize.js'
import {
  getMissingTrainerFields,
  isWordReadyForTrainer,
} from './lesson-readiness.js'

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wordAudioService: WordAudioService,
    private readonly coursesService: CoursesService,
    private readonly unsplashService: UnsplashService,
  ) {}

  async list(
    userId: string,
    courseId: string,
    query: LessonListQuery,
  ): Promise<LessonListResponse> {
    const ctx = await this.requireCourseAccess(userId, courseId)

    const [totalCount, lessons] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId } }),
      this.prisma.lesson.findMany({
        where: { courseId },
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
    const currentPosition = ctx.membership?.currentLesson?.position ?? null
    const currentLessonId = ctx.membership?.currentLessonId ?? null

    return {
      totalCount,
      hasMore: query.offset + lessons.length < totalCount,
      courseId,
      currentLessonId,
      canEdit: ctx.canEdit,
      items: lessons.map((lesson) =>
        this.toListItem(
          lesson,
          courseId,
          cards,
          currentPosition,
          currentLessonId,
        ),
      ),
    }
  }

  async create(
    userId: string,
    courseId: string,
    input: CreateLessonInput,
  ): Promise<LessonDetail> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    this.assertCanEdit(ctx)

    const title = input.title.trim()
    const aggregate = await this.prisma.lesson.aggregate({
      where: { courseId },
      _max: { position: true },
    })
    const position = (aggregate._max.position ?? 0) + 1

    const lesson = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lesson.create({
        data: {
          courseId,
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

      if (position === 1) {
        await this.coursesService.ensureFirstLessonCurrent(
          tx,
          courseId,
          created.id,
        )
      }

      return created
    })

    const refreshed = await this.requireCourseAccess(userId, courseId)
    const currentPosition =
      refreshed.membership?.currentLesson?.position ?? null

    return this.toDetail(
      lesson,
      courseId,
      new Map(),
      currentPosition,
      refreshed.membership?.currentLessonId ?? null,
      refreshed.canEdit,
    )
  }

  async getById(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<LessonDetail> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    const lesson = await this.findCourseLesson(courseId, lessonId)
    const cards = await this.loadUserCards(
      userId,
      lesson.words.map((item) => item.wordId),
    )
    const currentPosition = ctx.membership?.currentLesson?.position ?? null

    return this.toDetail(
      lesson,
      courseId,
      cards,
      currentPosition,
      ctx.membership?.currentLessonId ?? null,
      ctx.canEdit,
    )
  }

  async rename(
    userId: string,
    courseId: string,
    lessonId: string,
    title: string,
  ): Promise<LessonDetail> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    this.assertCanEdit(ctx)
    await this.findCourseLesson(courseId, lessonId)
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { title: title.trim() },
    })
    return this.getById(userId, courseId, lessonId)
  }

  async move(
    userId: string,
    courseId: string,
    lessonId: string,
    input: MoveLessonInput,
  ): Promise<LessonDetail> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    this.assertCanEdit(ctx)
    const lesson = await this.findCourseLesson(courseId, lessonId)
    const swapPosition =
      input.direction === 'up' ? lesson.position - 1 : lesson.position + 1

    const neighbor = await this.prisma.lesson.findUnique({
      where: {
        courseId_position: {
          courseId,
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

    return this.getById(userId, courseId, lessonId)
  }

  async delete(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    this.assertCanEdit(ctx)
    const lesson = await this.findCourseLesson(courseId, lessonId)

    const membershipsOnLesson = await this.prisma.courseMembership.findMany({
      where: { courseId, currentLessonId: lessonId },
    })
    const previousLesson =
      lesson.position > 1
        ? await this.prisma.lesson.findUnique({
            where: {
              courseId_position: {
                courseId,
                position: lesson.position - 1,
              },
            },
          })
        : null

    await this.prisma.$transaction(async (tx) => {
      await tx.courseMembership.updateMany({
        where: { courseId, currentLessonId: lessonId },
        data: { currentLessonId: null },
      })

      await tx.lesson.delete({ where: { id: lessonId } })

      const remaining = await tx.lesson.findMany({
        where: { courseId },
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

      if (previousLesson) {
        const updatedPrevious = await tx.lesson.findUniqueOrThrow({
          where: { id: previousLesson.id },
        })
        const nextAfterPrevious = await tx.lesson.findUnique({
          where: {
            courseId_position: {
              courseId,
              position: updatedPrevious.position + 1,
            },
          },
        })
        const maxPosition = nextAfterPrevious
          ? nextAfterPrevious.position
          : updatedPrevious.position

        for (const membership of membershipsOnLesson) {
          await this.coursesService.transferCourseWindowToDictionary(
            tx,
            membership.userId,
            courseId,
            maxPosition,
          )
          await tx.courseMembership.update({
            where: { id: membership.id },
            data: { currentLessonId: previousLesson.id },
          })
        }
      }
    })
  }

  async addExistingWord(
    userId: string,
    courseId: string,
    lessonId: string,
    wordId: string,
  ): Promise<LessonWordItem> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    this.assertCanEdit(ctx)
    const lesson = await this.findCourseLesson(courseId, lessonId)
    const addToDictionary = await this.isNextLessonForUser(
      userId,
      courseId,
      lesson.position,
    )

    const word = await this.prisma.word.findUnique({ where: { id: wordId } })
    if (!word) {
      throw new NotFoundException('Word not found')
    }

    const existingLink = await this.prisma.lessonWord.findUnique({
      where: {
        lessonId_wordId: { lessonId, wordId },
      },
    })
    if (existingLink) {
      throw new ConflictException('Word already in lesson')
    }

    const aggregate = await this.prisma.lessonWord.aggregate({
      where: { lessonId },
      _max: { position: true },
    })
    const position = (aggregate._max.position ?? 0) + 1

    const card = await this.prisma.userCard.findUnique({
      where: {
        userId_wordId: { userId, wordId },
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
            data: { lessonId, wordId, position },
          })

          const userCard = await tx.userCard.findUniqueOrThrow({
            where: {
              userId_wordId: { userId, wordId },
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
    courseId: string,
    lessonId: string,
    draft: WordDraft,
  ): Promise<Word> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    this.assertCanEdit(ctx)
    const lesson = await this.findCourseLesson(courseId, lessonId)
    const addToDictionary = await this.isNextLessonForUser(
      userId,
      courseId,
      lesson.position,
    )

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
                  createdViaLesson: true,
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

          await tx.lessonWord.create({
            data: {
              lessonId,
              wordId: existing.id,
              position: (aggregate._max.position ?? 0) + 1,
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
    courseId: string,
    lessonId: string,
    wordId: string,
    input: RemoveLessonWordInput,
  ): Promise<{ requiresDisposition: boolean }> {
    const ctx = await this.requireCourseAccess(userId, courseId)
    this.assertCanEdit(ctx)
    await this.findCourseLesson(courseId, lessonId)

    const link = await this.prisma.lessonWord.findUnique({
      where: {
        lessonId_wordId: { lessonId, wordId },
      },
    })
    if (!link) {
      throw new NotFoundException('Word not in lesson')
    }

    const card = await this.prisma.userCard.findUnique({
      where: {
        userId_wordId: { userId, wordId },
      },
    })

    const otherLinks = await this.prisma.lessonWord.count({
      where: {
        wordId,
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
    courseId: string,
    lessonId: string,
  ): Promise<TrainingReadiness> {
    await this.requireCourseAccess(userId, courseId)
    const lesson = await this.findCourseLesson(courseId, lessonId)
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
      canStart: readyCount >= 1,
      missingByWord,
      trainerAvailable: false,
    }
  }

  private async requireCourseAccess(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        createdBy: { select: { id: true, role: true } },
      },
    })

    if (!course) {
      throw new NotFoundException('Course not found')
    }

    const membership = await this.prisma.courseMembership.findUnique({
      where: {
        courseId_userId: { courseId, userId },
      },
      include: {
        currentLesson: { select: { id: true, title: true, position: true } },
      },
    })

    const isCreator = course.createdByUserId === userId
    const hasMemberAccess =
      membership !== null && membership.status === 'accepted'
    const effectivelyActive = isEffectivelyActive({
      active: course.active,
      creatorRole: course.createdBy.role,
    })

    if (!isCreator && !hasMemberAccess) {
      throw new NotFoundException('Course not found')
    }

    if (!isCreator && !effectivelyActive) {
      throw new NotFoundException('Course not found')
    }

    return {
      course,
      membership: hasMemberAccess ? membership : null,
      isCreator,
      effectivelyActive,
      canEdit: isCreator && effectivelyActive,
    }
  }

  private assertCanEdit(ctx: { canEdit: boolean }): void {
    if (!ctx.canEdit) {
      throw new ForbiddenException('Cannot edit course content')
    }
  }

  private async findCourseLesson(courseId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, courseId },
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

  private async isNextLessonForUser(
    userId: string,
    courseId: string,
    lessonPosition: number,
  ): Promise<boolean> {
    const membership = await this.prisma.courseMembership.findUnique({
      where: {
        courseId_userId: { courseId, userId },
      },
      include: {
        currentLesson: { select: { position: true } },
      },
    })

    const currentPosition = membership?.currentLesson?.position ?? null
    return (
      this.resolveStatus(
        lessonPosition,
        currentPosition,
        membership?.currentLessonId ?? null,
      ) === 'next'
    )
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
    courseId: string,
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
      courseId,
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
    courseId: string,
    cards: Map<string, { id: string; progress: number; inDictionary: boolean }>,
    currentPosition: number | null,
    currentLessonId: string | null,
    canEdit: boolean,
  ): LessonDetail {
    const listItem = this.toListItem(
      lesson,
      courseId,
      cards,
      currentPosition,
      currentLessonId,
    )

    return {
      ...listItem,
      canEdit,
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
