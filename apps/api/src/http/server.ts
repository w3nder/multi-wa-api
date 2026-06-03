import { parseCorsOrigins } from '@multi-wa/config'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import underPressure from '@fastify/under-pressure'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Container } from '../container'
import { registerAuth } from './auth'
import { errorHandler } from './error'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'
import { messageRoutes } from './routes/messages'
import { sessionRoutes } from './routes/sessions'
import { webhookRoutes } from './routes/webhooks'

export async function buildApp(container: Container): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: container.config.LOG_LEVEL },
    bodyLimit: container.config.BODY_LIMIT,
    trustProxy: true
  })

  await app.register(helmet)
  await app.register(cors, { origin: parseCorsOrigins(container.config.CORS_ORIGINS) })
  await app.register(rateLimit, {
    max: container.config.RATE_LIMIT_MAX,
    timeWindow: container.config.RATE_LIMIT_WINDOW
  })
  await app.register(underPressure, { maxEventLoopDelay: 1000 })

  await registerAuth(app, container)
  app.setErrorHandler(errorHandler)

  await app.register(async (instance) => {
    healthRoutes(instance, container)
  })

  await app.register(
    async (instance) => {
      authRoutes(instance, container)
    },
    { prefix: '/auth' }
  )

  await app.register(
    async (instance) => {
      instance.addHook('preHandler', instance.authenticate)
      sessionRoutes(instance, container)
      messageRoutes(instance, container)
    },
    { prefix: '/sessions' }
  )

  await app.register(
    async (instance) => {
      instance.addHook('preHandler', instance.authenticate)
      webhookRoutes(instance, container)
    },
    { prefix: '/webhooks' }
  )

  return app
}
