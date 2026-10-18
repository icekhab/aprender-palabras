import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { loginSchema, type AuthUser } from '@aprender-palabras/contracts'
import type { Response } from 'express'
import { AuthService } from './auth.service.js'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './auth.constants.js'
import type { AuthenticatedRequest } from './auth.types.js'
import { Public } from './public.decorator.js'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException('Invalid login data')
    }

    const session = await this.authService.login(result.data)
    if (!session) {
      throw new UnauthorizedException('Invalid login or password')
    }

    response.cookie(SESSION_COOKIE_NAME, session.token, {
      ...sessionCookieOptions(),
      expires: session.expiresAt,
    })

    return session.user
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest): AuthUser {
    return request.authUser
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(request.sessionToken)
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions())
  }
}
