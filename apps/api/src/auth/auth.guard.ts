import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'
import { AuthService } from './auth.service.js'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './auth.constants.js'
import type { AuthenticatedRequest } from './auth.types.js'
import { IS_PUBLIC_KEY } from './public.decorator.js'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.cookies?.[SESSION_COOKIE_NAME] as unknown

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Authentication required')
    }

    const user = await this.authService.findUserByToken(token)
    if (!user) {
      const response = context.switchToHttp().getResponse<Response>()
      response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions())
      throw new UnauthorizedException('Invalid session')
    }

    request.authUser = user
    request.sessionToken = token
    return true
  }
}
