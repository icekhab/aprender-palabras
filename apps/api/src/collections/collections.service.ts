import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  CreateCollectionTrainerResponse,
  CreateWordCollectionInput,
  SetWordCollectionStatusInput,
  UpdateWordCollectionInput,
  WordCollectionDetail,
  WordCollectionListItem,
  WordCollectionListResponse,
  WordCollectionStatus,
  WordCollectionWordItem,
  WordDraft,
} from '@aprender-palabras/contracts'
import { Prisma } from '../generated/prisma/client.js'
import { isWordReadyForTrainer } from '../lessons/lesson-readiness.js'
import { PrismaService } from '../prisma.service.js'
import {
  compareByPriority,
  madridDateString,
  MAX_TRAINER_WORDS,
  type SelectionCard,
} from '../training/selection.js'
import { TrainingService } from '../training/training.service.js'
import { WordsService } from '../words/words.service.js'

type CollectionWithItems = {
  id: string
  title: string
  status: WordCollectionStatus
  createdAt: Date
  updatedAt: Date
  items: Array<{
    wordId: string
    position: number
    word: {
      id: string
      spanish: string
      russian: string
      wrongRussian: string[]
      wrongSpanish: string[]
    }
  }>
}

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wordsService: WordsService,
    private readonly trainingService: TrainingService,
  ) {}

  async list(
    userId: string,
    role: 'user' | 'teacher' | 'admin',
    q?: string,
  ): Promise<WordCollectionListResponse> {
    const query = q?.trim()
    const isAdmin = role === 'admin'
    const collections = await this.prisma.wordCollection.findMany({
      where: {
        ...(isAdmin ? {} : { status: 'ready' }),
        ...(query
          ? {
              title: {
                contains: query,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      orderBy: { title: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            word: {
              select: {
                id: true,
                spanish: true,
                russian: true,
                wrongRussian: true,
                wrongSpanish: true,
              },
            },
          },
        },
        memberships: {
          where: { userId },
          select: { addedAt: true },
          take: 1,
        },
      },
    })

    const wordIds = [
      ...new Set(
        collections.flatMap((collection) =>
          collection.items.map((item) => item.wordId),
        ),
      ),
    ]
    const cards = await this.loadUserCards(userId, wordIds)
    const mine: WordCollectionListItem[] = []
    const catalog: WordCollectionListItem[] = []
    const adminDrafts: WordCollectionListItem[] = []

    for (const collection of collections) {
      const membership = collection.memberships[0] ?? null
      const item = this.toListItem(collection, membership?.addedAt ?? null, cards)
      if (collection.status !== 'ready') {
        if (isAdmin) {
          adminDrafts.push(item)
        }
        continue
      }
      if (item.added) {
        mine.push(item)
      } else {
        catalog.push(item)
      }
    }

    mine.sort((a, b) => {
      const aTime = a.addedAt ?? ''
      const bTime = b.addedAt ?? ''
      return bTime.localeCompare(aTime)
    })
    adminDrafts.sort((a, b) => a.title.localeCompare(b.title))

    return { mine, catalog, adminDrafts: isAdmin ? adminDrafts : [] }
  }

  async getById(
    userId: string,
    collectionId: string,
    role: 'user' | 'teacher' | 'admin' = 'user',
  ): Promise<WordCollectionDetail> {
    const collection = await this.findCollectionOrThrow(collectionId)
    if (collection.status !== 'ready' && role !== 'admin') {
      throw new NotFoundException('Collection not found')
    }
    const membership = await this.prisma.userCollection.findUnique({
      where: {
        userId_collectionId: { userId, collectionId },
      },
      select: { addedAt: true },
    })
    const cards = await this.loadUserCards(
      userId,
      collection.items.map((item) => item.wordId),
    )
    return this.toDetail(collection, membership?.addedAt ?? null, cards)
  }

  async create(
    adminUserId: string,
    input: CreateWordCollectionInput,
  ): Promise<WordCollectionDetail> {
    const title = input.title.trim()
    const created = await this.prisma.wordCollection.create({
      data: {
        title,
        status: 'created',
        createdByUserId: adminUserId,
      },
    })
    return this.getById(adminUserId, created.id, 'admin')
  }

  async update(
    userId: string,
    collectionId: string,
    input: UpdateWordCollectionInput,
  ): Promise<WordCollectionDetail> {
    await this.requireCollection(collectionId)
    await this.prisma.wordCollection.update({
      where: { id: collectionId },
      data: { title: input.title.trim() },
    })
    return this.getById(userId, collectionId, 'admin')
  }

  async setStatus(
    userId: string,
    collectionId: string,
    input: SetWordCollectionStatusInput,
  ): Promise<WordCollectionDetail> {
    const collection = await this.findCollectionOrThrow(collectionId)
    const next = input.status

    if (next === 'ready') {
      if (collection.items.length === 0) {
        throw new BadRequestException(
          'Cannot publish a collection with no words',
        )
      }
      await this.prisma.wordCollection.update({
        where: { id: collectionId },
        data: { status: 'ready' },
      })
      return this.getById(userId, collectionId, 'admin')
    }

    // inactive
    await this.prisma.$transaction(async (tx) => {
      await tx.userCollectionIntroducedWord.deleteMany({
        where: { collectionId },
      })
      await tx.userCollection.deleteMany({
        where: { collectionId },
      })
      await tx.wordCollection.update({
        where: { id: collectionId },
        data: { status: 'inactive' },
      })
    })
    return this.getById(userId, collectionId, 'admin')
  }

  async remove(collectionId: string): Promise<void> {
    await this.requireCollection(collectionId)
    await this.prisma.wordCollection.delete({
      where: { id: collectionId },
    })
  }

  async addWord(
    actorUserId: string,
    collectionId: string,
    wordId: string,
  ): Promise<WordCollectionDetail> {
    await this.requireCollection(collectionId)
    const word = await this.prisma.word.findUnique({
      where: { id: wordId },
      select: { id: true },
    })
    if (!word) {
      throw new NotFoundException('Word not found')
    }

    const existing = await this.prisma.wordCollectionItem.findUnique({
      where: {
        collectionId_wordId: { collectionId, wordId },
      },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('Word already in collection')
    }

    const maxPosition = await this.prisma.wordCollectionItem.aggregate({
      where: { collectionId },
      _max: { position: true },
    })
    const position = (maxPosition._max.position ?? 0) + 1

    const offeredByUser = new Map<string, string[]>()

    await this.prisma.$transaction(async (tx) => {
      await tx.wordCollectionItem.create({
        data: { collectionId, wordId, position },
      })

      const memberships = await tx.userCollection.findMany({
        where: { collectionId },
        select: { userId: true },
      })

      for (const membership of memberships) {
        const cardId = await this.ensureCardForUser(
          tx,
          membership.userId,
          collectionId,
          wordId,
        )
        if (cardId) {
          const list = offeredByUser.get(membership.userId) ?? []
          list.push(cardId)
          offeredByUser.set(membership.userId, list)
        }
      }
    })

    for (const [userId, cardIds] of offeredByUser) {
      await this.trainingService.offerNewWordsToTodaySlot5(userId, cardIds)
    }

    return this.getById(actorUserId, collectionId, 'admin')
  }

  async addNewWord(
    actorUserId: string,
    collectionId: string,
    draft: WordDraft,
  ): Promise<WordCollectionDetail> {
    await this.requireCollection(collectionId)

    let wordId: string
    try {
      const created = await this.wordsService.createAdminWord(
        actorUserId,
        draft,
      )
      wordId = created.id
    } catch (error) {
      const conflictWordId = conflictWordIdFromError(error)
      if (!conflictWordId) {
        throw error
      }
      wordId = conflictWordId
    }

    const alreadyInCollection = await this.prisma.wordCollectionItem.findUnique(
      {
        where: {
          collectionId_wordId: { collectionId, wordId },
        },
        select: { id: true },
      },
    )
    if (alreadyInCollection) {
      throw new ConflictException('Word already in collection')
    }

    return this.addWord(actorUserId, collectionId, wordId)
  }

  async removeWord(collectionId: string, wordId: string): Promise<void> {
    const collection = await this.findCollectionOrThrow(collectionId)
    const item = await this.prisma.wordCollectionItem.findUnique({
      where: {
        collectionId_wordId: { collectionId, wordId },
      },
      select: { id: true, position: true },
    })
    if (!item) {
      throw new NotFoundException('Word not in collection')
    }

    if (collection.status === 'ready' && collection.items.length <= 1) {
      throw new BadRequestException(
        'Cannot remove the last word from a ready collection',
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.wordCollectionItem.delete({ where: { id: item.id } })
      await tx.wordCollectionItem.updateMany({
        where: {
          collectionId,
          position: { gt: item.position },
        },
        data: { position: { decrement: 1 } },
      })
    })
  }

  async addForUser(
    userId: string,
    collectionId: string,
  ): Promise<WordCollectionDetail> {
    const collection = await this.findCollectionOrThrow(collectionId)
    if (collection.status !== 'ready') {
      throw new NotFoundException('Collection not found')
    }

    const offeredCardIds: string[] = []

    await this.prisma.$transaction(async (tx) => {
      await tx.userCollection.upsert({
        where: {
          userId_collectionId: { userId, collectionId },
        },
        create: { userId, collectionId },
        update: {},
      })

      for (const item of collection.items) {
        const cardId = await this.ensureCardForUser(
          tx,
          userId,
          collectionId,
          item.wordId,
        )
        if (cardId) {
          offeredCardIds.push(cardId)
        }
      }
    })

    await this.trainingService.offerNewWordsToTodaySlot5(userId, offeredCardIds)

    return this.getById(userId, collectionId)
  }

  async removeForUser(userId: string, collectionId: string): Promise<void> {
    const membership = await this.prisma.userCollection.findUnique({
      where: {
        userId_collectionId: { userId, collectionId },
      },
      select: { id: true },
    })
    if (!membership) {
      throw new NotFoundException('Collection not added')
    }

    await this.prisma.$transaction(async (tx) => {
      const introduced = await tx.userCollectionIntroducedWord.findMany({
        where: { userId, collectionId },
        select: { wordId: true },
      })

      for (const row of introduced) {
        const otherProvenance = await tx.userCollectionIntroducedWord.count({
          where: {
            userId,
            wordId: row.wordId,
            collectionId: { not: collectionId },
          },
        })
        if (otherProvenance > 0) {
          continue
        }

        const card = await tx.userCard.findUnique({
          where: {
            userId_wordId: { userId, wordId: row.wordId },
          },
          select: { id: true, completedTrainerCount: true },
        })
        if (!card) {
          continue
        }
        if (card.completedTrainerCount > 0) {
          continue
        }

        await tx.dailyTrainerWord.deleteMany({
          where: { userCardId: card.id },
        })
        await tx.userCard.delete({ where: { id: card.id } })
      }

      await tx.userCollectionIntroducedWord.deleteMany({
        where: { userId, collectionId },
      })
      await tx.userCollection.delete({ where: { id: membership.id } })
    })
  }

  async createTrainer(
    userId: string,
    collectionId: string,
  ): Promise<CreateCollectionTrainerResponse> {
    const membership = await this.prisma.userCollection.findUnique({
      where: {
        userId_collectionId: { userId, collectionId },
      },
      select: { id: true },
    })
    if (!membership) {
      throw new BadRequestException('Add the collection before training')
    }

    const collection = await this.findCollectionOrThrow(collectionId)
    if (collection.status !== 'ready') {
      throw new BadRequestException('Collection is not available for training')
    }
    const cards = await this.loadUserCards(
      userId,
      collection.items.map((item) => item.wordId),
    )

    const ready: SelectionCard[] = []
    for (const item of collection.items) {
      const card = cards.get(item.wordId)
      if (!card || !card.inDictionary) {
        continue
      }
      if (!isWordReadyForTrainer(item.word)) {
        continue
      }
      ready.push({
        userCardId: card.id,
        wordId: item.wordId,
        progress: card.progress,
        lastTrainedAt: card.lastTrainedAt,
        completedTrainerCount: card.completedTrainerCount,
        showCount: card.showCount,
        addedAt: card.addedAt,
        source: card.source,
        inCurrentLesson: false,
        inRecentLessons: false,
      })
    }

    if (ready.length === 0) {
      throw new BadRequestException('No words ready for training')
    }

    const picked = [...ready]
      .sort((a, b) => compareByPriority(a, b))
      .slice(0, MAX_TRAINER_WORDS)

    const date = madridDateString()
    const dayDate = calendarDate(date)

    const trainerId = await this.prisma.$transaction(async (tx) => {
      let day = await tx.dailyTrainingDay.findUnique({
        where: {
          userId_date: { userId, date: dayDate },
        },
        select: { id: true },
      })
      if (!day) {
        day = await tx.dailyTrainingDay.create({
          data: { userId, date: dayDate },
          select: { id: true },
        })
      }

      const existingCollections = await tx.dailyTrainer.count({
        where: { dayId: day.id, kind: 'collection' },
      })

      const trainer = await tx.dailyTrainer.create({
        data: {
          dayId: day.id,
          kind: 'collection',
          slot: existingCollections,
          sourceLabel: collection.title,
          words: {
            create: picked.map((card, index) => ({
              userCardId: card.userCardId,
              position: index + 1,
            })),
          },
        },
        select: { id: true },
      })

      return trainer.id
    })

    return { trainerId }
  }

  private async requireCollection(collectionId: string): Promise<void> {
    const found = await this.prisma.wordCollection.findUnique({
      where: { id: collectionId },
      select: { id: true },
    })
    if (!found) {
      throw new NotFoundException('Collection not found')
    }
  }

  private async findCollectionOrThrow(
    collectionId: string,
  ): Promise<CollectionWithItems> {
    const collection = await this.prisma.wordCollection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            word: {
              select: {
                id: true,
                spanish: true,
                russian: true,
                wrongRussian: true,
                wrongSpanish: true,
              },
            },
          },
        },
      },
    })
    if (!collection) {
      throw new NotFoundException('Collection not found')
    }
    return collection
  }

  private async loadUserCards(
    userId: string,
    wordIds: string[],
  ): Promise<
    Map<
      string,
      {
        id: string
        wordId: string
        progress: number
        inDictionary: boolean
        source: 'manual' | 'lesson'
        lastTrainedAt: Date | null
        completedTrainerCount: number
        showCount: number
        addedAt: Date
      }
    >
  > {
    if (wordIds.length === 0) {
      return new Map()
    }
    const cards = await this.prisma.userCard.findMany({
      where: { userId, wordId: { in: wordIds } },
      select: {
        id: true,
        wordId: true,
        progress: true,
        inDictionary: true,
        source: true,
        lastTrainedAt: true,
        completedTrainerCount: true,
        showCount: true,
        addedAt: true,
      },
    })
    return new Map(cards.map((card) => [card.wordId, card]))
  }

  /** Returns userCardId when the card newly entered the dictionary. */
  private async ensureCardForUser(
    tx: Prisma.TransactionClient,
    userId: string,
    collectionId: string,
    wordId: string,
  ): Promise<string | null> {
    const existing = await tx.userCard.findUnique({
      where: {
        userId_wordId: { userId, wordId },
      },
      select: { id: true, inDictionary: true },
    })

    if (existing) {
      if (!existing.inDictionary) {
        await tx.userCard.update({
          where: { id: existing.id },
          data: { inDictionary: true },
        })
        await tx.userCollectionIntroducedWord.upsert({
          where: {
            userId_collectionId_wordId: { userId, collectionId, wordId },
          },
          create: { userId, collectionId, wordId },
          update: {},
        })
        return existing.id
      }
      return null
    }

    const created = await tx.userCard.create({
      data: {
        userId,
        wordId,
        source: 'manual',
        inDictionary: true,
      },
    })
    await tx.userCollectionIntroducedWord.create({
      data: { userId, collectionId, wordId },
    })
    return created.id
  }

  private toListItem(
    collection: CollectionWithItems & { memberships?: unknown },
    addedAt: Date | null,
    cards: Map<
      string,
      {
        id: string
        progress: number
        inDictionary: boolean
      }
    >,
  ): WordCollectionListItem {
    const added = addedAt !== null
    const progress = this.averageProgress(collection, cards, added)
    const canTrain = added && this.countReady(collection, cards) > 0
    return {
      id: collection.id,
      title: collection.title,
      status: collection.status,
      wordCount: collection.items.length,
      progress,
      added,
      canTrain: canTrain && collection.status === 'ready',
      addedAt: addedAt?.toISOString() ?? null,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    }
  }

  private toDetail(
    collection: CollectionWithItems,
    addedAt: Date | null,
    cards: Map<
      string,
      {
        id: string
        progress: number
        inDictionary: boolean
      }
    >,
  ): WordCollectionDetail {
    const list = this.toListItem(collection, addedAt, cards)
    const words: WordCollectionWordItem[] = collection.items.map((item) => {
      const card = cards.get(item.wordId)
      const inDict = Boolean(card?.inDictionary)
      return {
        wordId: item.wordId,
        spanish: item.word.spanish,
        russian: item.word.russian,
        position: item.position,
        userCardId: inDict ? (card?.id ?? null) : null,
        progress: inDict ? (card?.progress ?? null) : null,
        readyForTrainer: inDict && isWordReadyForTrainer(item.word),
      }
    })

    return {
      ...list,
      words,
    }
  }

  private averageProgress(
    collection: CollectionWithItems,
    cards: Map<string, { progress: number; inDictionary: boolean }>,
    added: boolean,
  ): number | null {
    if (!added || collection.items.length === 0) {
      return null
    }
    let sum = 0
    let count = 0
    for (const item of collection.items) {
      const card = cards.get(item.wordId)
      if (!card?.inDictionary) {
        continue
      }
      sum += card.progress
      count += 1
    }
    if (count === 0) {
      return null
    }
    return Math.round(sum / count)
  }

  private countReady(
    collection: CollectionWithItems,
    cards: Map<string, { inDictionary: boolean }>,
  ): number {
    let count = 0
    for (const item of collection.items) {
      const card = cards.get(item.wordId)
      if (!card?.inDictionary) {
        continue
      }
      if (isWordReadyForTrainer(item.word)) {
        count += 1
      }
    }
    return count
  }
}

function calendarDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function conflictWordIdFromError(error: unknown): string | null {
  if (!(error instanceof ConflictException)) {
    return null
  }
  const response = error.getResponse()
  if (typeof response === 'object' && response !== null && 'wordId' in response) {
    const wordId = (response as { wordId?: unknown }).wordId
    return typeof wordId === 'string' ? wordId : null
  }
  return null
}
