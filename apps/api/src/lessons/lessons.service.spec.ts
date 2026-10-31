import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordDraft } from '@aprender-palabras/contracts'
import { CoursesService } from '../courses/courses.service.js'
import { UnsplashService } from '../integrations/unsplash/unsplash.service.js'
import { PrismaService } from '../prisma.service.js'
import { WordAudioService } from '../speech/word-audio.service.js'
import { isWordReadyForTrainer } from './lesson-readiness.js'
import { LessonsService } from './lessons.service.js'

const emptyDraft = (overrides: Partial<WordDraft> = {}): WordDraft => ({
  spanish: 'esperar',
  russian: 'ждать',
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
  ...overrides,
})

describe('LessonsService helpers', () => {
  it('keeps readiness helper available for course-scoped lessons', () => {
    expect(
      isWordReadyForTrainer({
        spanish: 'hola',
        russian: 'привет',
        wrongRussian: ['a', 'b', 'c'],
        wrongSpanish: ['x', 'y', 'z'],
      }),
    ).toBe(true)
  })
})

describe('LessonsService.addNewWord', () => {
  const tx = {
    word: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      findUniqueOrThrow: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    userCard: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    lessonWord: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
      aggregate: vi.fn<(args: unknown) => Promise<{ _max: { position: number | null } }>>(),
      create: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  const prisma = {
    $transaction: vi.fn<
      (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
    >(async (callback) => callback(tx)),
    course: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    courseMembership: {
      findUnique: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
    lesson: {
      findFirst: vi.fn<(args: unknown) => Promise<unknown>>(),
    },
  }

  const wordAudioService = {
    ensureWordAudio: vi.fn<(wordId: string) => Promise<boolean>>(),
  }

  const coursesService = {}

  const unsplashService = {
    trackDownload: vi.fn<(downloadLocation: string) => Promise<void>>(),
  }

  let service: LessonsService

  beforeEach(() => {
    vi.clearAllMocks()
    wordAudioService.ensureWordAudio.mockResolvedValue(true)
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    )
    prisma.course.findUnique.mockResolvedValue({
      id: 'course-1',
      active: true,
      createdByUserId: 'user-1',
      createdBy: { id: 'user-1', role: 'teacher' },
    })
    prisma.courseMembership.findUnique.mockResolvedValue({
      status: 'accepted',
      currentLesson: { id: 'lesson-1', title: 'L1', position: 1 },
    })
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      position: 2,
      words: [],
    })
    service = new LessonsService(
      prisma as unknown as PrismaService,
      wordAudioService as unknown as WordAudioService,
      coursesService as unknown as CoursesService,
      unsplashService as unknown as UnsplashService,
    )
  })

  it('tracks Unsplash download when a new lesson word is created with an image', async () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    const createdWord = {
      id: 'word-1',
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: [],
      definitionEs: null,
      examples: [],
      partOfSpeech: null,
      gender: null,
      wrongRussian: [],
      wrongSpanish: [],
      imageUrl: 'https://images.unsplash.com/photo.jpg',
      imagePhotographerName: 'Ada',
      imagePhotographerUrl: 'https://unsplash.com/@ada',
      imagePageUrl: 'https://unsplash.com/photos/abc',
      imageProvider: 'unsplash' as const,
      createdAt: now,
      updatedAt: now,
    }

    tx.word.findUnique.mockResolvedValue(null)
    tx.word.create.mockResolvedValue(createdWord)
    tx.lessonWord.findUnique.mockResolvedValue(null)
    tx.userCard.findUnique.mockResolvedValue(null)
    tx.userCard.create.mockResolvedValue({ id: 'card-1' })
    tx.lessonWord.aggregate.mockResolvedValue({ _max: { position: 0 } })
    tx.lessonWord.create.mockResolvedValue({ id: 'lw-1' })

    await expect(
      service.addNewWord(
        'user-1',
        'course-1',
        'lesson-1',
        emptyDraft({
          imageUrl: 'https://images.unsplash.com/photo.jpg',
          imagePhotographerName: 'Ada',
          imagePhotographerUrl: 'https://unsplash.com/@ada',
          imagePageUrl: 'https://unsplash.com/photos/abc',
          imageProvider: 'unsplash',
          imageDownloadLocation: 'https://api.unsplash.com/photos/abc/download',
        }),
      ),
    ).resolves.toMatchObject({ id: 'word-1' })

    expect(unsplashService.trackDownload).toHaveBeenCalledWith(
      'https://api.unsplash.com/photos/abc/download',
    )
    expect(wordAudioService.ensureWordAudio).toHaveBeenCalledWith('word-1')
  })

  it('does not track Unsplash download when reusing an existing word', async () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    const existingWord = {
      id: 'word-existing',
      spanish: 'esperar',
      russian: 'ждать',
      additionalTranslations: [],
      definitionEs: null,
      examples: [],
      partOfSpeech: null,
      gender: null,
      wrongRussian: [],
      wrongSpanish: [],
      imageUrl: 'https://images.unsplash.com/old.jpg',
      imagePhotographerName: 'Old',
      imagePhotographerUrl: 'https://unsplash.com/@old',
      imagePageUrl: 'https://unsplash.com/photos/old',
      imageProvider: 'unsplash' as const,
      createdAt: now,
      updatedAt: now,
    }

    tx.word.findUnique.mockResolvedValue(existingWord)
    tx.lessonWord.findUnique.mockResolvedValue(null)
    tx.userCard.findUnique.mockResolvedValue(null)
    tx.userCard.create.mockResolvedValue({ id: 'card-2' })
    tx.lessonWord.aggregate.mockResolvedValue({ _max: { position: 1 } })
    tx.lessonWord.create.mockResolvedValue({ id: 'lw-2' })

    await expect(
      service.addNewWord(
        'user-1',
        'course-1',
        'lesson-1',
        emptyDraft({
          imageUrl: 'https://images.unsplash.com/new.jpg',
          imageProvider: 'unsplash',
          imageDownloadLocation: 'https://api.unsplash.com/photos/abc/download',
        }),
      ),
    ).resolves.toMatchObject({ id: 'word-existing' })

    expect(tx.word.create).not.toHaveBeenCalled()
    expect(unsplashService.trackDownload).not.toHaveBeenCalled()
    expect(wordAudioService.ensureWordAudio).not.toHaveBeenCalled()
  })
})
