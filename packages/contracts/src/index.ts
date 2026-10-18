import { z } from 'zod'

export const loginSchema = z.object({
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
})

export type LoginInput = z.infer<typeof loginSchema>

export interface AuthUser {
  id: string
  login: string
}

export interface TestItem {
  name: string
  size: number
}

export type TestsResponse = TestItem[]
