import { parseCorsOrigins } from '@multi-wa/config'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import underPressure from '@fastify/under-pressure'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod'
import type { OpenAPIV3 } from 'openapi-types'
import type { Container } from '../container'
import { registerAuth } from './auth'
import { errorHandler } from './error'
import { decorateOpenApi } from './openapi'
import { authRoutes } from './routes/auth'
import { groupRoutes } from './routes/groups'
import { healthRoutes } from './routes/health'
import { messageRoutes } from './routes/messages'
import { sessionRoutes } from './routes/sessions'
import { webhookRoutes } from './routes/webhooks'
import type { AppInstance } from './types'

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
    trustProxy: true
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: parseCorsOrigins(container.config.CORS_ORIGINS) })
  await app.register(rateLimit, {
    max: container.config.RATE_LIMIT_MAX,
    timeWindow: container.config.RATE_LIMIT_WINDOW
  })
  await app.register(underPressure, { maxEventLoopDelay: 1000 })

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
    transform: jsonSchemaTransform,
    transformObject: (input) =>
      decorateOpenApi((input as { openapiObject: OpenAPIV3.Document }).openapiObject)
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  await registerAuth(app, container)
  app.setErrorHandler(errorHandler)

  await app.register(async (instance) => {
    healthRoutes(instance.withTypeProvider<ZodTypeProvider>(), container)
  })

  await app.register(
    async (instance) => {
      authRoutes(instance.withTypeProvider<ZodTypeProvider>(), container)
    },
    { prefix: '/auth' }
  )

  await app.register(
    async (instance) => {
      const scoped: AppInstance = instance.withTypeProvider<ZodTypeProvider>()
      scoped.addHook('preHandler', scoped.authenticate)
      sessionRoutes(scoped, container)
      messageRoutes(scoped, container)
      groupRoutes(scoped, container)
    },
    { prefix: '/sessions' }
  )

  await app.register(
    async (instance) => {
      const scoped: AppInstance = instance.withTypeProvider<ZodTypeProvider>()
      scoped.addHook('preHandler', scoped.authenticate)
      webhookRoutes(scoped, container)
    },
    { prefix: '/webhooks' }
  )

  return app
}
