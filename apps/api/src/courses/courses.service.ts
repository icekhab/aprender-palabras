import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  CourseDetail,
  CourseListItem,
  CourseListResponse,
  CourseListView,
  CourseMemberItem,
  CoursePendingInvite,
  CreateCourseInput,
  InvitedUserCourseItem,
  InvitedUserDetail,
  InvitedUserItem,
  SetCurrentLessonPreview,
  UpdateCourseInput,
} from '@aprender-palabras/contracts'
import { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma.service.js'
import {
  isEffectivelyActive,
  isTeacherOrAdmin,
  normalizeLogin,
} from './course-access.js'

type CourseWithCreator = {
  id: string
  title: string
  active: boolean
  createdByUserId: string
  createdAt: Date
  createdBy: { id: string; login: string; role: 'user' | 'teacher' | 'admin' }
  lessons: Array<{ id: string; title: string; position: number }>
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    view: CourseListView = 'student',
  ): Promise<CourseListResponse> {
    if (view === 'creator') {
      return this.listCreated(userId)
    }
    return this.listAsStudent(userId)
  }

  private async listAsStudent(userId: string): Promise<CourseListResponse> {
    const memberships = await this.prisma.courseMembership.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            createdBy: { select: { id: true, login: true, role: true } },
            lessons: {
              select: { id: true, title: true, position: true },
              orderBy: { position: 'asc' },
            },
          },
        },
        currentLesson: { select: { id: true, title: true, position: true } },
      },
    })

    const pending: CoursePendingInvite[] = []
    const items: CourseListItem[] = []

    for (const membership of memberships) {
      if (membership.status === 'pending') {
        pending.push({
          id: membership.courseId,
          title: membership.course.title,
          createdByLogin: membership.course.createdBy.login,
          invitedAt: membership.invitedAt.toISOString(),
        })
        continue
      }

      if (membership.status !== 'accepted') {
        continue
      }

      const effectivelyActive = isEffectivelyActive({
        active: membership.course.active,
        creatorRole: membership.course.createdBy.role,
      })

      items.push({
        id: membership.course.id,
        title: membership.course.title,
        active: membership.course.active,
        effectivelyActive,
        createdByUserId: membership.course.createdByUserId,
        createdByLogin: membership.course.createdBy.login,
        isCreator: membership.course.createdByUserId === userId,
        membershipStatus: membership.status,
        currentLessonId: membership.currentLessonId,
        currentLessonTitle: membership.currentLesson?.title ?? null,
        currentLessonPosition: membership.currentLesson?.position ?? null,
        lessonCount: membership.course.lessons.length,
        createdAt: membership.course.createdAt.toISOString(),
      })
    }

    items.sort((a, b) => {
      const rank = (item: CourseListItem) => {
        if (
          item.effectivelyActive &&
          item.currentLessonPosition !== null &&
          item.currentLessonPosition < item.lessonCount
        ) {
          return 0
        }
        if (item.effectivelyActive) {
          return 1
        }
        return 2
      }
      const rankDiff = rank(a) - rank(b)
      if (rankDiff !== 0) {
        return rankDiff
      }
      return a.title.localeCompare(b.title, 'es')
    })

    pending.sort((a, b) => a.title.localeCompare(b.title, 'es'))

    return { pending, items }
  }

  private async listCreated(userId: string): Promise<CourseListResponse> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!actor || !isTeacherOrAdmin(actor.role)) {
      throw new ForbiddenException('Teacher or admin role required')
    }

    const createdCourses = await this.prisma.course.findMany({
      where: { createdByUserId: userId },
      include: {
        createdBy: { select: { id: true, login: true, role: true } },
        lessons: {
          select: { id: true, title: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
    })

    const items: CourseListItem[] = createdCourses.map((course) => ({
      id: course.id,
      title: course.title,
      active: course.active,
      effectivelyActive: isEffectivelyActive({
        active: course.active,
        creatorRole: course.createdBy.role,
      }),
      createdByUserId: course.createdByUserId,
      createdByLogin: course.createdBy.login,
      isCreator: true,
      membershipStatus: null,
      currentLessonId: null,
      currentLessonTitle: null,
      currentLessonPosition: null,
      lessonCount: course.lessons.length,
      createdAt: course.createdAt.toISOString(),
    }))

    items.sort((a, b) => {
      const rank = (item: CourseListItem) => (item.effectivelyActive ? 0 : 1)
      const rankDiff = rank(a) - rank(b)
      if (rankDiff !== 0) {
        return rankDiff
      }
      return a.title.localeCompare(b.title, 'es')
    })

    return { pending: [], items }
  }

  async create(
    userId: string,
    input: CreateCourseInput,
  ): Promise<CourseDetail> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!actor || !isTeacherOrAdmin(actor.role)) {
      throw new ForbiddenException('Teacher or admin role required')
    }

    const title = input.title.trim()
    const course = await this.prisma.course.create({
      data: {
        title,
        createdByUserId: userId,
        active: true,
      },
      include: {
        createdBy: { select: { id: true, login: true, role: true } },
        lessons: {
          select: { id: true, title: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
    })

    return this.toDetail(course, null, userId)
  }

  async getById(userId: string, courseId: string): Promise<CourseDetail> {
    const { course, membership } = await this.requireMemberAccess(
      userId,
      courseId,
    )
    return this.toDetail(course, membership, userId)
  }

  async update(
    userId: string,
    courseId: string,
    input: UpdateCourseInput,
  ): Promise<CourseDetail> {
    const { course } = await this.requireCreator(userId, courseId)
    const effectivelyActive = isEffectivelyActive({
      active: course.active,
      creatorRole: course.createdBy.role,
    })

    if (input.title !== undefined && !effectivelyActive) {
      throw new ForbiddenException('Course is not effectively active')
    }

    if (input.active === false && !effectivelyActive && !course.active) {
      throw new ForbiddenException('Course is not effectively active')
    }

    // Creator with teacher/admin can always re-activate (`active: true`) even
    // when currently inactive via flag; demotion blocks via requireCreator role.
    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    })

    return this.getById(userId, courseId)
  }

  async invite(
    userId: string,
    courseId: string,
    login: string,
  ): Promise<CourseMemberItem> {
    const { course } = await this.requireCreator(userId, courseId)
    this.assertEffectivelyActive(course)

    if (course.lessons.length === 0) {
      throw new BadRequestException('Course needs at least one lesson')
    }

    const target = await this.prisma.user.findUnique({
      where: { normalizedLogin: normalizeLogin(login) },
      select: { id: true, login: true },
    })

    if (!target) {
      throw new NotFoundException('User not found')
    }

    const selfInvite = target.id === userId
    const firstLesson = selfInvite ? (course.lessons[0] ?? null) : null

    try {
      const membership = await this.prisma.$transaction(async (tx) => {
        const created = await tx.courseMembership.create({
          data: {
            courseId,
            userId: target.id,
            status: selfInvite ? 'accepted' : 'pending',
            acceptedAt: selfInvite ? new Date() : null,
            currentLessonId: selfInvite ? (firstLesson?.id ?? null) : null,
          },
          include: {
            user: { select: { id: true, login: true } },
            currentLesson: {
              select: { id: true, title: true, position: true },
            },
          },
        })

        if (selfInvite && firstLesson) {
          const next = course.lessons.find(
            (lesson) => lesson.position === firstLesson.position + 1,
          )
          await this.transferCourseWindowToDictionary(
            tx,
            target.id,
            courseId,
            next ? next.position : firstLesson.position,
          )
        }

        return created
      })

      return this.toMemberItem(membership, course.lessons)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User already has a membership')
      }
      throw error
    }
  }

  async accept(userId: string, courseId: string): Promise<CourseDetail> {
    const membership = await this.prisma.courseMembership.findUnique({
      where: {
        courseId_userId: { courseId, userId },
      },
    })

    if (!membership || membership.status !== 'pending') {
      throw new NotFoundException('Invitation not found')
    }

    const course = await this.loadCourse(courseId)
    const firstLesson = course.lessons[0] ?? null

    await this.prisma.$transaction(async (tx) => {
      await tx.courseMembership.update({
        where: { id: membership.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          currentLessonId: firstLesson?.id ?? null,
        },
      })

      if (firstLesson) {
        const next = course.lessons.find(
          (lesson) => lesson.position === firstLesson.position + 1,
        )
        await this.transferCourseWindowToDictionary(
          tx,
          userId,
          courseId,
          next ? next.position : firstLesson.position,
        )
      }
    })

    return this.getById(userId, courseId)
  }

  async reject(userId: string, courseId: string): Promise<{ ok: true }> {
    const membership = await this.prisma.courseMembership.findUnique({
      where: {
        courseId_userId: { courseId, userId },
      },
    })

    if (!membership || membership.status !== 'pending') {
      throw new NotFoundException('Invitation not found')
    }

    await this.prisma.courseMembership.delete({ where: { id: membership.id } })
    return { ok: true }
  }

  async removeMember(
    actorUserId: string,
    courseId: string,
    targetUserId: string,
  ): Promise<{ ok: true }> {
    const course = await this.loadCourse(courseId)
    const isCreator = course.createdByUserId === actorUserId
    if (!isCreator && actorUserId !== targetUserId) {
      throw new ForbiddenException('Cannot remove another member')
    }

    const membership = await this.prisma.courseMembership.findUnique({
      where: {
        courseId_userId: { courseId, userId: targetUserId },
      },
    })

    if (!membership) {
      throw new NotFoundException('Membership not found')
    }

    await this.prisma.courseMembership.delete({ where: { id: membership.id } })
    return { ok: true }
  }

  async listMembers(
    userId: string,
    courseId: string,
  ): Promise<CourseMemberItem[]> {
    await this.requireCreator(userId, courseId)
    const course = await this.loadCourse(courseId)
    const memberships = await this.prisma.courseMembership.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, login: true } },
        currentLesson: { select: { id: true, title: true, position: true } },
      },
    })

    const items = memberships.map((membership) =>
      this.toMemberItem(membership, course.lessons),
    )

    items.sort((a, b) => {
      const rank = (member: CourseMemberItem) => {
        if (member.status === 'pending') {
          return 0
        }
        if (member.status === 'accepted' && member.nextLessonId !== null) {
          return 1
        }
        return 2
      }
      const rankDiff = rank(a) - rank(b)
      if (rankDiff !== 0) {
        return rankDiff
      }
      return a.login.localeCompare(b.login, 'es')
    })

    return items
  }

  async previewSetCurrent(
    actorUserId: string,
    courseId: string,
    targetUserId: string,
    lessonId: string,
  ): Promise<SetCurrentLessonPreview> {
    const { course } = await this.requireMemberOrCreatorAction(
      actorUserId,
      courseId,
      targetUserId,
    )
    this.assertEffectivelyActive(course)

    const lesson = course.lessons.find((item) => item.id === lessonId)
    if (!lesson) {
      throw new NotFoundException('Lesson not found')
    }

    const next = course.lessons.find(
      (item) => item.position === lesson.position + 1,
    )
    const maxPosition = next ? next.position : lesson.position

    const rangeLessons = await this.prisma.lesson.findMany({
      where: {
        courseId,
        position: { lte: maxPosition },
      },
      include: { words: true },
    })

    const wordIds = [
      ...new Set(
        rangeLessons.flatMap((item) => item.words.map((word) => word.wordId)),
      ),
    ]
    const cards = await this.prisma.userCard.findMany({
      where: { userId: targetUserId, wordId: { in: wordIds } },
    })
    const cardByWord = new Map(cards.map((card) => [card.wordId, card]))

    let wordsToAdd = 0
    let wordsAlreadyInDictionary = 0
    for (const wordId of wordIds) {
      if (cardByWord.get(wordId)?.inDictionary) {
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

  async setMemberCurrentLesson(
    actorUserId: string,
    courseId: string,
    targetUserId: string,
    lessonId: string,
  ): Promise<CourseMemberItem> {
    const { course } = await this.requireMemberOrCreatorAction(
      actorUserId,
      courseId,
      targetUserId,
    )
    this.assertEffectivelyActive(course)

    const lesson = course.lessons.find((item) => item.id === lessonId)
    if (!lesson) {
      throw new NotFoundException('Lesson not found')
    }

    const membership = await this.prisma.courseMembership.findUnique({
      where: {
        courseId_userId: { courseId, userId: targetUserId },
      },
    })

    if (!membership || membership.status !== 'accepted') {
      throw new NotFoundException('Membership not found')
    }

    if (membership.currentLessonId === lessonId) {
      const current = await this.prisma.courseMembership.findUniqueOrThrow({
        where: { id: membership.id },
        include: {
          user: { select: { id: true, login: true } },
          currentLesson: { select: { id: true, title: true, position: true } },
        },
      })
      return this.toMemberItem(current, course.lessons)
    }

    const next = course.lessons.find(
      (item) => item.position === lesson.position + 1,
    )

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.transferCourseWindowToDictionary(
        tx,
        targetUserId,
        courseId,
        next ? next.position : lesson.position,
      )

      return tx.courseMembership.update({
        where: { id: membership.id },
        data: {
          currentLessonId: lessonId,
        },
        include: {
          user: { select: { id: true, login: true } },
          currentLesson: { select: { id: true, title: true, position: true } },
        },
      })
    })

    return this.toMemberItem(updated, course.lessons)
  }

  async listInvitedUsers(creatorUserId: string): Promise<InvitedUserItem[]> {
    const memberships = await this.prisma.courseMembership.findMany({
      where: {
        course: { createdByUserId: creatorUserId },
        NOT: { userId: creatorUserId },
      },
      include: {
        user: { select: { id: true, login: true } },
      },
    })

    const byUser = new Map<string, InvitedUserItem>()
    for (const membership of memberships) {
      const existing = byUser.get(membership.userId)
      if (existing) {
        existing.courseCount += 1
      } else {
        byUser.set(membership.userId, {
          userId: membership.user.id,
          login: membership.user.login,
          courseCount: 1,
        })
      }
    }

    return [...byUser.values()].sort((a, b) =>
      a.login.localeCompare(b.login, 'es'),
    )
  }

  async getInvitedUserDetail(
    creatorUserId: string,
    targetUserId: string,
  ): Promise<InvitedUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, login: true },
    })
    if (!user) {
      throw new NotFoundException('User not found')
    }

    const memberships = await this.prisma.courseMembership.findMany({
      where: {
        userId: targetUserId,
        course: { createdByUserId: creatorUserId },
      },
      include: {
        course: {
          include: {
            createdBy: { select: { role: true } },
            lessons: {
              select: { id: true, title: true, position: true },
              orderBy: { position: 'asc' },
            },
          },
        },
        currentLesson: { select: { id: true, title: true, position: true } },
      },
    })

    if (memberships.length === 0) {
      throw new NotFoundException('No courses for this user')
    }

    const courses: InvitedUserCourseItem[] = memberships.map((membership) => {
      const next = membership.currentLesson
        ? membership.course.lessons.find(
            (lesson) =>
              lesson.position === membership.currentLesson!.position + 1,
          )
        : null

      return {
        courseId: membership.courseId,
        title: membership.course.title,
        effectivelyActive: isEffectivelyActive({
          active: membership.course.active,
          creatorRole: membership.course.createdBy.role,
        }),
        status: membership.status,
        currentLessonId: membership.currentLessonId,
        currentLessonTitle: membership.currentLesson?.title ?? null,
        currentLessonPosition: membership.currentLesson?.position ?? null,
        nextLessonId: next?.id ?? null,
        nextLessonTitle: next?.title ?? null,
        lessonCount: membership.course.lessons.length,
      }
    })

    courses.sort((a, b) => a.title.localeCompare(b.title, 'es'))

    return {
      userId: user.id,
      login: user.login,
      courses,
    }
  }

  async transferCourseWindowToDictionary(
    tx: Prisma.TransactionClient,
    userId: string,
    courseId: string,
    maxPositionInclusive: number,
  ): Promise<void> {
    const lessons = await tx.lesson.findMany({
      where: {
        courseId,
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
          userId_wordId: { userId, wordId },
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

  async ensureFirstLessonCurrent(
    tx: Prisma.TransactionClient,
    courseId: string,
    firstLessonId: string,
  ): Promise<void> {
    await tx.courseMembership.updateMany({
      where: {
        courseId,
        status: 'accepted',
        currentLessonId: null,
      },
      data: { currentLessonId: firstLessonId },
    })
  }

  private async requireCreator(userId: string, courseId: string) {
    const course = await this.loadCourse(courseId)
    if (course.createdByUserId !== userId) {
      throw new ForbiddenException('Only the course creator can do this')
    }
    return { course }
  }

  private async requireMemberAccess(userId: string, courseId: string) {
    const course = await this.loadCourse(courseId)
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

    // Participants cannot open a deactivated course; creator still can
    // (e.g. to reactivate).
    if (!isCreator && !effectivelyActive) {
      throw new NotFoundException('Course not found')
    }

    return { course, membership: hasMemberAccess ? membership : null }
  }

  private async requireMemberOrCreatorAction(
    actorUserId: string,
    courseId: string,
    targetUserId: string,
  ) {
    const course = await this.loadCourse(courseId)
    const isCreator = course.createdByUserId === actorUserId
    if (!isCreator && actorUserId !== targetUserId) {
      throw new ForbiddenException('Cannot manage another member')
    }

    if (!isCreator) {
      await this.requireMemberAccess(actorUserId, courseId)
    }

    return { course, isCreator }
  }

  private assertEffectivelyActive(course: CourseWithCreator): void {
    if (
      !isEffectivelyActive({
        active: course.active,
        creatorRole: course.createdBy.role,
      })
    ) {
      throw new ForbiddenException('Course is not effectively active')
    }
  }

  private async loadCourse(courseId: string): Promise<CourseWithCreator> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        createdBy: { select: { id: true, login: true, role: true } },
        lessons: {
          select: { id: true, title: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
    })

    if (!course) {
      throw new NotFoundException('Course not found')
    }

    return course
  }

  private toDetail(
    course: CourseWithCreator,
    membership: {
      status: 'pending' | 'accepted'
      currentLessonId: string | null
      currentLesson?: {
        id: string
        title: string
        position: number
      } | null
    } | null,
    userId: string,
  ): CourseDetail {
    return {
      id: course.id,
      title: course.title,
      active: course.active,
      effectivelyActive: isEffectivelyActive({
        active: course.active,
        creatorRole: course.createdBy.role,
      }),
      createdByUserId: course.createdByUserId,
      createdByLogin: course.createdBy.login,
      isCreator: course.createdByUserId === userId,
      membershipStatus: membership?.status ?? null,
      currentLessonId: membership?.currentLessonId ?? null,
      currentLessonTitle: membership?.currentLesson?.title ?? null,
      currentLessonPosition: membership?.currentLesson?.position ?? null,
      lessonCount: course.lessons.length,
      createdAt: course.createdAt.toISOString(),
    }
  }

  private toMemberItem(
    membership: {
      userId: string
      status: 'pending' | 'accepted'
      currentLessonId: string | null
      invitedAt: Date
      acceptedAt: Date | null
      user: { id: string; login: string }
      currentLesson: {
        id: string
        title: string
        position: number
      } | null
    },
    lessons: Array<{ id: string; title: string; position: number }>,
  ): CourseMemberItem {
    const next = membership.currentLesson
      ? lessons.find(
          (lesson) => lesson.position === membership.currentLesson!.position + 1,
        )
      : null

    return {
      userId: membership.user.id,
      login: membership.user.login,
      status: membership.status,
      currentLessonId: membership.currentLessonId,
      currentLessonTitle: membership.currentLesson?.title ?? null,
      currentLessonPosition: membership.currentLesson?.position ?? null,
      nextLessonId: next?.id ?? null,
      nextLessonTitle: next?.title ?? null,
      invitedAt: membership.invitedAt.toISOString(),
      acceptedAt: membership.acceptedAt?.toISOString() ?? null,
    }
  }
}
