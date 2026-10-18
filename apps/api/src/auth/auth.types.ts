import type { AuthUser } from '@aprender-palabras/contracts'
import type { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  authUser: AuthUser
  sessionToken: string
}
