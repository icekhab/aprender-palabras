import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { AuthenticatedRequest } from './auth.types.js'

@Injectable()
export class TeacherGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const role = request.authUser?.role

    if (role !== 'teacher' && role !== 'admin') {
      throw new ForbiddenException('Teacher or admin role required')
    }

    return true
  }
}
