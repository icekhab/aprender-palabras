import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  DailyTrainingTodayResponse,
  DailyTrainerItem,
  TrainerSessionResponse,
  TrainerSessionWord,
} from '@aprender-palabras/contracts'
import { Prisma } from '../generated/prisma/client.js'
import { isWordReadyForTrainer } from '../lessons/lesson-readiness.js'
import { PrismaService } from '../prisma.service.js'
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

  async getToday(userId: string): Promise<DailyTrainingTodayResponse> {
    const date = madridDateString()
    const dayDate = calendarDate(date)

    let day = await this.prisma.dailyTrainingDay.findUnique({
      where: {
        userId_date: { userId, date: dayDate },
      },
      include: trainerInclude,
    })

    if (!day) {
      day = await this.createDay(userId, dayDate)
    }

    const readyCardCount = await this.countReadyCards(userId)
    const dailyTrainers = day.trainers.filter((item) => item.kind === 'daily')
    const allDailyCompleted =
      dailyTrainers.length > 0 &&
      dailyTrainers.every((item) => item.status === 'completed')

    if (allDailyCompleted) {
      const openExtra = day.trainers.find(
        (item) => item.kind === 'extra' && item.status === 'not_started',
      )
      if (!openExtra) {
        await this.ensureExtraTrainer(userId, day.id)
        day = await this.prisma.dailyTrainingDay.findUniqueOrThrow({
          where: { id: day.id },
          include: trainerInclude,
        })
      }
    }

    const visible = day.trainers
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
      trainers: visible,
    }
  }

  private async createDay(userId: string, dayDate: Date) {
    const { cards, currentLessonPosition, lastCompletedTrainerAt } =
      await this.loadSelectionContext(userId)
    const built = buildDailyTrainers({
      cards,
      currentLessonPosition,
      anchor: resolveAnchor(lastCompletedTrainerAt),
    })

    try {
      return await this.prisma.dailyTrainingDay.create({
        data: {
          userId,
          date: dayDate,
          trainers: {
            create: built.map((trainer) => ({
              kind: trainer.kind,
              slot: trainer.slot,
              sourceLabel: trainer.sourceLabel,
              words: {
                create: trainer.userCardIds.map((userCardId, index) => ({
                  userCardId,
                  position: index + 1,
                })),
              },
            })),
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
    currentLessonPosition: number | null
    lastCompletedTrainerAt: Date | null
  }> {
    const [user, userCards, lessons] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          currentLessonId: true,
          lastCompletedTrainerAt: true,
          currentLesson: { select: { position: true } },
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
      this.prisma.lesson.findMany({
        where: { userId },
        select: {
          position: true,
          words: { select: { wordId: true } },
        },
      }),
    ])

    const lessonPositionsByWord = new Map<string, number[]>()
    for (const lesson of lessons) {
      for (const lessonWord of lesson.words) {
        const positions = lessonPositionsByWord.get(lessonWord.wordId) ?? []
        positions.push(lesson.position)
        lessonPositionsByWord.set(lessonWord.wordId, positions)
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
        lessonPositions: lessonPositionsByWord.get(item.wordId) ?? [],
      }))

    return {
      cards,
      currentLessonPosition: user.currentLesson?.position ?? null,
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
