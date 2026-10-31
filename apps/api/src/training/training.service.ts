import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  CompleteTrainerCardInput,
  CompleteTrainerResponse,
  DailyTrainingTodayResponse,
  DailyTrainerItem,
  TrainerSessionResponse,
  TrainerSessionWord,
} from '@aprender-palabras/contracts'
import { Prisma } from '../generated/prisma/client.js'
import { isWordReadyForTrainer } from '../lessons/lesson-readiness.js'
import { PrismaService } from '../prisma.service.js'
import { applyProgressChange } from './progress.js'
import {
  buildDailyTrainers,
  buildExtraTrainer,
  madridDateString,
  resolveAnchor,
  type SelectionCard,
} from './selection.js'

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrainerSession(
    userId: string,
    trainerId: string,
  ): Promise<TrainerSessionResponse> {
    const trainer = await this.prisma.dailyTrainer.findFirst({
      where: {
        id: trainerId,
        status: 'not_started',
        day: { userId },
      },
      include: sessionTrainerInclude,
    })

    if (!trainer) {
      throw new NotFoundException('Trainer not found')
    }

    return {
      id: trainer.id,
      kind: trainer.kind,
      slot: trainer.slot,
      sourceLabel: trainer.sourceLabel,
      words: trainer.words.map((item) => toSessionWord(item)),
    }
  }

  async completeTrainer(
    userId: string,
    trainerId: string,
    cards: CompleteTrainerCardInput[],
    timing?: { startedAt?: string; completedAt?: string },
  ): Promise<CompleteTrainerResponse> {
    const trainer = await this.prisma.dailyTrainer.findFirst({
      where: {
        id: trainerId,
        day: { userId },
      },
      include: {
        ...sessionTrainerInclude,
        day: { select: { id: true } },
      },
    })

    if (!trainer) {
      throw new NotFoundException('Trainer not found')
    }

    if (trainer.status === 'completed') {
      throw new ConflictException('Trainer already completed')
    }

    const expectedIds = new Set(
      trainer.words.map((item) => item.userCard.id),
    )
    if (cards.length !== expectedIds.size) {
      throw new BadRequestException('Card results must match trainer words')
    }

    const errorByCard = new Map<string, number>()
    for (const card of cards) {
      if (!expectedIds.has(card.userCardId)) {
        throw new BadRequestException('Unknown card in results')
      }
      if (errorByCard.has(card.userCardId)) {
        throw new BadRequestException('Duplicate card in results')
      }
      if (
        !Number.isInteger(card.errorCount) ||
        card.errorCount < 0 ||
        card.errorCount > 1000
      ) {
        throw new BadRequestException('Invalid error count')
      }
      errorByCard.set(card.userCardId, card.errorCount)
    }

    const now = new Date()
    const sessionTimes = parseClientSessionTimes(
      timing?.startedAt,
      timing?.completedAt,
      now,
    )
    const results = trainer.words.map((item) => {
      const errorCount = errorByCard.get(item.userCard.id) ?? 0
      const oldProgress = item.userCard.progress
      const { delta, newProgress } = applyProgressChange(
        oldProgress,
        errorCount,
      )
      return {
        userCardId: item.userCard.id,
        spanish: item.userCard.word.spanish,
        russian: item.userCard.word.russian,
        errorCount,
        oldProgress,
        delta,
        newProgress,
      }
    })

    await this.prisma.$transaction(async (tx) => {
      for (const result of results) {
        await tx.userCard.update({
          where: { id: result.userCardId },
          data: {
            progress: result.newProgress,
            lastTrainedAt: now,
            completedTrainerCount: { increment: 1 },
            showCount: { increment: 1 },
          },
        })
      }

      await tx.dailyTrainer.update({
        where: { id: trainerId },
        data: {
          status: 'completed',
          startedAt: sessionTimes?.startedAt ?? null,
          completedAt: sessionTimes?.completedAt ?? null,
        },
      })

      await tx.user.update({
        where: { id: userId },
        data: { lastCompletedTrainerAt: now },
      })
    })

    const dayId = trainer.day.id
    let dayTrainers = await this.prisma.dailyTrainer.findMany({
      where: { dayId },
      select: { id: true, kind: true, status: true, slot: true },
      orderBy: [{ kind: 'asc' }, { slot: 'asc' }],
    })

    const dailyTrainers = dayTrainers.filter((item) => item.kind === 'daily')
    const allDailyCompleted =
      dailyTrainers.length > 0 &&
      dailyTrainers.every((item) => item.status === 'completed')
    const openExtra = dayTrainers.find(
      (item) => item.kind === 'extra' && item.status === 'not_started',
    )

    if (allDailyCompleted && !openExtra) {
      await this.ensureExtraTrainer(userId, dayId)
      dayTrainers = await this.prisma.dailyTrainer.findMany({
        where: { dayId },
        select: { id: true, kind: true, status: true, slot: true },
        orderBy: [{ kind: 'asc' }, { slot: 'asc' }],
      })
    }

    const dailyAfter = dayTrainers.filter((item) => item.kind === 'daily')
    const nextTrainer = dayTrainers
      .filter((item) => item.status === 'not_started')
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === 'daily' ? -1 : 1
        }
        return a.slot - b.slot
      })[0]

    return {
      cards: results,
      wordCount: results.length,
      dailyTotal: dailyAfter.length,
      dailyCompleted: dailyAfter.filter((item) => item.status === 'completed')
        .length,
      nextTrainerId: nextTrainer?.id ?? null,
    }
  }

  async getToday(userId: string): Promise<DailyTrainingTodayResponse> {
    const date = madridDateString()
    const dayDate = calendarDate(date)
    const readyCardCount = await this.countReadyCards(userId)

    let day = await this.prisma.dailyTrainingDay.findUnique({
      where: {
        userId_date: { userId, date: dayDate },
      },
      include: trainerInclude,
    })

    if (!day) {
      if (readyCardCount === 0) {
        return {
          date,
          readyCardCount,
          canGenerate: true,
          trainers: [],
        }
      }
      day = await this.createDay(userId, dayDate)
    }

    return this.buildTodayResponse(userId, date, day, readyCardCount)
  }

  async generateToday(userId: string): Promise<DailyTrainingTodayResponse> {
    const date = madridDateString()
    const dayDate = calendarDate(date)

    let day = await this.prisma.dailyTrainingDay.findUnique({
      where: {
        userId_date: { userId, date: dayDate },
      },
      include: trainerInclude,
    })

    const dailyCount =
      day?.trainers.filter((item) => item.kind === 'daily').length ?? 0

    if (!day) {
      day = await this.createDay(userId, dayDate)
    } else if (dailyCount === 0) {
      day = await this.fillDailyTrainers(userId, day.id)
    }

    const readyCardCount = await this.countReadyCards(userId)
    return this.buildTodayResponse(userId, date, day, readyCardCount)
  }

  private async buildTodayResponse(
    userId: string,
    date: string,
    day: DayWithTrainers,
    readyCardCount: number,
  ): Promise<DailyTrainingTodayResponse> {
    let current = day
    const dailyTrainers = current.trainers.filter(
      (item) => item.kind === 'daily',
    )
    const canGenerate = dailyTrainers.length === 0
    const allDailyCompleted =
      dailyTrainers.length > 0 &&
      dailyTrainers.every((item) => item.status === 'completed')

    if (allDailyCompleted) {
      const openExtra = current.trainers.find(
        (item) => item.kind === 'extra' && item.status === 'not_started',
      )
      if (!openExtra) {
        await this.ensureExtraTrainer(userId, current.id)
        current = await this.prisma.dailyTrainingDay.findUniqueOrThrow({
          where: { id: current.id },
          include: trainerInclude,
        })
      }
    }

    const visible = current.trainers
      .filter((item) => item.status === 'not_started')
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === 'daily' ? -1 : 1
        }
        return a.slot - b.slot
      })
      .map((item) => toTrainerItem(item))

    return {
      date,
      readyCardCount,
      canGenerate,
      trainers: visible,
    }
  }

  private async createDay(userId: string, dayDate: Date) {
    const built = await this.buildDailyTrainerCreates(userId)

    try {
      return await this.prisma.dailyTrainingDay.create({
        data: {
          userId,
          date: dayDate,
          trainers: {
            create: built,
          },
        },
        include: trainerInclude,
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.dailyTrainingDay.findUniqueOrThrow({
          where: {
            userId_date: { userId, date: dayDate },
          },
          include: trainerInclude,
        })
      }
      throw error
    }
  }

  private async fillDailyTrainers(
    userId: string,
    dayId: string,
  ): Promise<DayWithTrainers> {
    const built = await this.buildDailyTrainerCreates(userId)
    for (const trainer of built) {
      await this.prisma.dailyTrainer.create({
        data: {
          dayId,
          kind: trainer.kind,
          slot: trainer.slot,
          sourceLabel: trainer.sourceLabel,
          words: {
            create: trainer.words.create,
          },
        },
      })
    }

    return this.prisma.dailyTrainingDay.findUniqueOrThrow({
      where: { id: dayId },
      include: trainerInclude,
    })
  }

  private async buildDailyTrainerCreates(userId: string) {
    const { cards, hasActiveCourseLesson, lastCompletedTrainerAt } =
      await this.loadSelectionContext(userId)
    const built = buildDailyTrainers({
      cards,
      hasActiveCourseLesson,
      anchor: resolveAnchor(lastCompletedTrainerAt),
    })

    return built.map((trainer) => ({
      kind: trainer.kind,
      slot: trainer.slot,
      sourceLabel: trainer.sourceLabel,
      words: {
        create: trainer.userCardIds.map((userCardId, index) => ({
          userCardId,
          position: index + 1,
        })),
      },
    }))
  }

  private async ensureExtraTrainer(userId: string, dayId: string) {
    const { cards } = await this.loadSelectionContext(userId)
    const usedToday = new Set(
      (
        await this.prisma.dailyTrainerWord.findMany({
          where: { trainer: { dayId } },
          select: { userCardId: true },
        })
      ).map((item) => item.userCardId),
    )

    const existingExtras = await this.prisma.dailyTrainer.count({
      where: { dayId, kind: 'extra' },
    })
    const built = buildExtraTrainer({ cards, usedToday })
    if (!built) {
      return
    }

    try {
      await this.prisma.dailyTrainer.create({
        data: {
          dayId,
          kind: 'extra',
          slot: existingExtras,
          sourceLabel: built.sourceLabel,
          words: {
            create: built.userCardIds.map((userCardId, index) => ({
              userCardId,
              position: index + 1,
            })),
          },
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return
      }
      throw error
    }
  }

  private async loadSelectionContext(userId: string): Promise<{
    cards: SelectionCard[]
    hasActiveCourseLesson: boolean
    lastCompletedTrainerAt: Date | null
  }> {
    const [user, userCards, memberships] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          lastCompletedTrainerAt: true,
        },
      }),
      this.prisma.userCard.findMany({
        where: { userId, inDictionary: true },
        select: {
          id: true,
          wordId: true,
          source: true,
          progress: true,
          lastTrainedAt: true,
          completedTrainerCount: true,
          showCount: true,
          addedAt: true,
          word: {
            select: {
              spanish: true,
              russian: true,
              wrongRussian: true,
              wrongSpanish: true,
            },
          },
        },
      }),
      this.prisma.courseMembership.findMany({
        where: {
          userId,
          status: 'accepted',
          course: {
            active: true,
            createdBy: { role: { in: ['teacher', 'admin'] } },
          },
          currentLessonId: { not: null },
        },
        select: {
          currentLesson: { select: { id: true, position: true, courseId: true } },
          course: {
            select: {
              lessons: {
                select: {
                  position: true,
                  words: { select: { wordId: true } },
                },
              },
            },
          },
        },
      }),
    ])

    const inCurrent = new Set<string>()
    const inRecent = new Set<string>()
    let hasActiveCourseLesson = false

    for (const membership of memberships) {
      const current = membership.currentLesson
      if (!current) {
        continue
      }
      hasActiveCourseLesson = true
      for (const lesson of membership.course.lessons) {
        for (const lessonWord of lesson.words) {
          if (lesson.position === current.position) {
            inCurrent.add(lessonWord.wordId)
          } else if (
            lesson.position < current.position &&
            lesson.position >= current.position - 4
          ) {
            inRecent.add(lessonWord.wordId)
          }
        }
      }
    }

    const cards: SelectionCard[] = userCards
      .filter((item) => isWordReadyForTrainer(item.word))
      .map((item) => ({
        userCardId: item.id,
        wordId: item.wordId,
        progress: item.progress,
        lastTrainedAt: item.lastTrainedAt,
        completedTrainerCount: item.completedTrainerCount,
        showCount: item.showCount,
        addedAt: item.addedAt,
        source: item.source,
        inCurrentLesson: inCurrent.has(item.wordId),
        inRecentLessons: inRecent.has(item.wordId),
      }))

    return {
      cards,
      hasActiveCourseLesson,
      lastCompletedTrainerAt: user.lastCompletedTrainerAt,
    }
  }

  private async countReadyCards(userId: string): Promise<number> {
    const cards = await this.prisma.userCard.findMany({
      where: { userId, inDictionary: true },
      select: {
        word: {
          select: {
            spanish: true,
            russian: true,
            wrongRussian: true,
            wrongSpanish: true,
          },
        },
      },
    })
    return cards.filter((item) => isWordReadyForTrainer(item.word)).length
  }
}

const wordSessionSelect = {
  spanish: true,
  russian: true,
  additionalTranslations: true,
  definitionEs: true,
  examples: true,
  partOfSpeech: true,
  gender: true,
  wrongRussian: true,
  wrongSpanish: true,
  imageUrl: true,
  imagePhotographerName: true,
  imagePhotographerUrl: true,
  imagePageUrl: true,
  imageProvider: true,
} satisfies Prisma.WordSelect

const sessionTrainerInclude = {
  words: {
    orderBy: { position: 'asc' as const },
    include: {
      userCard: {
        select: {
          id: true,
          wordId: true,
          progress: true,
          completedTrainerCount: true,
          word: { select: wordSessionSelect },
        },
      },
    },
  },
} satisfies Prisma.DailyTrainerInclude

const trainerInclude = {
  trainers: {
    include: {
      words: {
        orderBy: { position: 'asc' as const },
        include: {
          userCard: {
            select: {
              id: true,
              wordId: true,
              progress: true,
              word: {
                select: {
                  spanish: true,
                  russian: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.DailyTrainingDayInclude

type DayWithTrainers = Prisma.DailyTrainingDayGetPayload<{
  include: typeof trainerInclude
}>

type SessionTrainer = Prisma.DailyTrainerGetPayload<{
  include: typeof sessionTrainerInclude
}>

function toTrainerItem(
  trainer: DayWithTrainers['trainers'][number],
): DailyTrainerItem {
  const words = trainer.words.map((item) => ({
    userCardId: item.userCard.id,
    wordId: item.userCard.wordId,
    spanish: item.userCard.word.spanish,
    russian: item.userCard.word.russian,
    progress: item.userCard.progress,
  }))

  return {
    id: trainer.id,
    kind: trainer.kind,
    slot: trainer.slot,
    sourceLabel: trainer.sourceLabel,
    wordCount: words.length,
    words,
  }
}

function toSessionWord(
  item: SessionTrainer['words'][number],
): TrainerSessionWord {
  const { word } = item.userCard
  const completedTrainerCount = item.userCard.completedTrainerCount

  return {
    userCardId: item.userCard.id,
    wordId: item.userCard.wordId,
    completedTrainerCount,
    showIntro: completedTrainerCount === 0,
    progress: item.userCard.progress,
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
  }
}

function calendarDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

/** Clock skew allowed for client completedAt vs server now. */
const CLIENT_TIME_SKEW_MS = 60_000
/** Max plausible session length for duration analytics. */
const MAX_SESSION_DURATION_MS = 3 * 60 * 60 * 1000

function parseClientDate(value: string | undefined): Date | null {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

/**
 * Soft-accept client session bounds. Invalid / missing / out-of-window → null
 * (completion still succeeds; duration stats simply skip the row).
 */
function parseClientSessionTimes(
  startedAtRaw: string | undefined,
  completedAtRaw: string | undefined,
  serverNow: Date,
): { startedAt: Date; completedAt: Date } | null {
  const startedAt = parseClientDate(startedAtRaw)
  const completedAt = parseClientDate(completedAtRaw)
  if (!startedAt || !completedAt) {
    return null
  }
  if (startedAt.getTime() > completedAt.getTime()) {
    return null
  }
  const durationMs = completedAt.getTime() - startedAt.getTime()
  if (durationMs > MAX_SESSION_DURATION_MS) {
    return null
  }
  if (completedAt.getTime() > serverNow.getTime() + CLIENT_TIME_SKEW_MS) {
    return null
  }
  return { startedAt, completedAt }
}
