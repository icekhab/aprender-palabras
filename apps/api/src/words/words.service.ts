import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type {
  DictionaryListItem,
  DictionaryListQuery,
  DictionaryListResponse,
  Word,
  WordDraft,
  WordPairInput,
} from '@aprender-palabras/contracts'
import { Prisma } from '../generated/prisma/client.js'
import { OpenAiService } from '../integrations/openai/openai.service.js'
import { UnsplashService } from '../integrations/unsplash/unsplash.service.js'
import { PrismaService } from '../prisma.service.js'
import { normalizeWordKey } from './word-normalize.js'

@Injectable()
export class WordsService {
  private readonly logger = new Logger(WordsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly unsplashService: UnsplashService,
  ) {}

  async preview(input: WordPairInput): Promise<WordDraft> {
    const spanish = input.spanish.trim()
    const russian = input.russian.trim()
    const emptyDraft = emptyWordDraft(spanish, russian)

    if (!this.openAiService.isConfigured()) {
      return emptyDraft
    }

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

  async list(
    userId: string,
    query: DictionaryListQuery,
  ): Promise<DictionaryListResponse> {
    const where = {
      userId,
      inDictionary: true,
    }

    const [totalCount, progressAggregate, cards] = await Promise.all([
      this.prisma.userCard.count({ where }),
      this.prisma.userCard.aggregate({
        where,
        _avg: { progress: true },
      }),
      this.prisma.userCard.findMany({
        where,
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
      hasMore: query.offset + cards.length < totalCount,
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

        return existing
      })

      if (
        draft.imageProvider === 'unsplash' &&
        draft.imageDownloadLocation
      ) {
        void this.unsplashService.trackDownload(draft.imageDownloadLocation)
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
