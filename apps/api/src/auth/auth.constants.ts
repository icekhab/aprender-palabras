import type { CookieOptions } from 'express'

export const SESSION_COOKIE_NAME = 'aprender_palabras_session'
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
}
