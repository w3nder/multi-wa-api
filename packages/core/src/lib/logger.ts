import { loadConfig } from '@multi-wa/config'
import { pino } from 'pino'

export type Logger = ReturnType<typeof pino>

let root: Logger | null = null

export function getLogger(): Logger {
  if (root) return root
  const env = loadConfig()
  root = pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } }
        : undefined
  })
  return root
}
