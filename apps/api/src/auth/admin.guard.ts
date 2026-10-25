import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { AuthenticatedRequest } from './auth.types.js'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (request.authUser?.role !== 'admin') {
      throw new ForbiddenException('Admin role required')
    }

    return true
  }
}
