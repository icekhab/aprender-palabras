import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  courseListViewSchema,
  createCourseSchema,
  inviteToCourseSchema,
  setMemberCurrentLessonSchema,
  updateCourseSchema,
  type CourseDetail,
  type CourseListResponse,
  type CourseMemberItem,
  type InvitedUserDetail,
  type InvitedUserItem,
  type SetCurrentLessonPreview,
} from '@aprender-palabras/contracts'
import type { AuthenticatedRequest } from '../auth/auth.types.js'
import { TeacherGuard } from '../auth/teacher.guard.js'
import { CoursesService } from './courses.service.js'

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('view') viewRaw?: string,
  ): Promise<CourseListResponse> {
    const parsed = courseListViewSchema.safeParse(viewRaw ?? 'student')
    if (!parsed.success) {
      throw new BadRequestException('Invalid view')
    }
    return this.coursesService.list(request.authUser.id, parsed.data)
  }

  @Post()
  @UseGuards(TeacherGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<CourseDetail> {
    const result = createCourseSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid course title')
    }
    return this.coursesService.create(request.authUser.id, result.data)
  }

  @Get('invited-users')
  @UseGuards(TeacherGuard)
  listInvitedUsers(
    @Req() request: AuthenticatedRequest,
  ): Promise<InvitedUserItem[]> {
    return this.coursesService.listInvitedUsers(request.authUser.id)
  }

  @Get('invited-users/:userId')
  @UseGuards(TeacherGuard)
  getInvitedUser(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<InvitedUserDetail> {
    return this.coursesService.getInvitedUserDetail(
      request.authUser.id,
      userId,
    )
  }

  @Get(':id')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourseDetail> {
    return this.coursesService.getById(request.authUser.id, id)
  }

  @Patch(':id')
  @UseGuards(TeacherGuard)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<CourseDetail> {
    const result = updateCourseSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid course update')
    }
    return this.coursesService.update(request.authUser.id, id, result.data)
  }

  @Post(':id/invite')
  @UseGuards(TeacherGuard)
  invite(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<CourseMemberItem> {
    const result = inviteToCourseSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid invite login')
    }
    return this.coursesService.invite(
      request.authUser.id,
      id,
      result.data.login,
    )
  }

  @Post(':id/accept')
  accept(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourseDetail> {
    return this.coursesService.accept(request.authUser.id, id)
  }

  @Post(':id/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.coursesService.reject(request.authUser.id, id)
  }

  @Get(':id/members')
  @UseGuards(TeacherGuard)
  listMembers(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourseMemberItem[]> {
    return this.coursesService.listMembers(request.authUser.id, id)
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ ok: true }> {
    return this.coursesService.removeMember(
      request.authUser.id,
      id,
      userId,
    )
  }

  @Post(':id/members/:userId/current-lesson/preview')
  previewCurrent(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
  ): Promise<SetCurrentLessonPreview> {
    const result = setMemberCurrentLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson id')
    }
    return this.coursesService.previewSetCurrent(
      request.authUser.id,
      id,
      userId,
      result.data.lessonId,
    )
  }

  @Patch(':id/members/:userId/current-lesson')
  setCurrent(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
  ): Promise<CourseMemberItem> {
    const result = setMemberCurrentLessonSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid lesson id')
    }
    return this.coursesService.setMemberCurrentLesson(
      request.authUser.id,
      id,
      userId,
      result.data.lessonId,
    )
  }
}
