import { errors } from '@multi-wa/core'
import type { ZodSchema } from 'zod'

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw errors.badRequest(message)
  }
  return result.data
}
