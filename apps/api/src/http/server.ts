import { parseCorsOrigins } from '@multi-wa/config'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import underPressure from '@fastify/under-pressure'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Container } from '../container'
import { registerAuth } from './auth'
import { errorHandler } from './error'
import { messageRequestExamples } from './openapi'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'
import { messageRoutes } from './routes/messages'
import { sessionRoutes } from './routes/sessions'
import { webhookRoutes } from './routes/webhooks'

export async function buildApp(container: Container): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      container.config.NODE_ENV === 'development'
        ? {
            level: container.config.LOG_LEVEL,
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' }
            }
          }
        : { level: container.config.LOG_LEVEL },
    bodyLimit: container.config.BODY_LIMIT,
    trustProxy: true,
    ajv: { customOptions: { strictSchema: false } }
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: parseCorsOrigins(container.config.CORS_ORIGINS) })

  await app.register(swagger, {
    openapi: {
      info: { title: 'multi-wa-api', version: '0.1.0' },
      components: {
        securitySchemes: {
          apiKey: { type: 'apiKey', name: 'x-api-key', in: 'header' },
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    },
    transformObject: (input) => {
      const openapiObject = (input as { openapiObject?: unknown }).openapiObject ?? input
      const spec = openapiObject as {
        paths?: Record<
          string,
          Record<string, { requestBody?: { content?: Record<string, { examples?: unknown }> } }>
        >
      }
      const media =
        spec.paths?.['/sessions/{id}/messages']?.post?.requestBody?.content?.['application/json']
      if (media) media.examples = messageRequestExamples()
      return openapiObject as never
    }
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })
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
