import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { Request } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()

    if (SAFE_METHODS.has(request.method)) {
      return true
    }

    const configuredOrigin = process.env.APP_ORIGIN ?? 'http://localhost:5173'
    const expectedOrigin = new URL(configuredOrigin).origin

    if (request.get('origin') !== expectedOrigin) {
      throw new ForbiddenException('Invalid request origin')
    }

    return true
  }
}
