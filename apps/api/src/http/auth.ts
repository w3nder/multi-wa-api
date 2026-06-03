import { errors } from '@multi-wa/core'
import fastifyJwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Container } from '../container'

export async function registerAuth(app: FastifyInstance, container: Container): Promise<void> {
  await app.register(fastifyJwt, { secret: container.config.JWT_SECRET })

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const apiKey = request.headers['x-api-key']
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      const principal = await container.authService.authenticateApiKey(apiKey)
      if (!principal) throw errors.unauthorized('invalid api key')
      request.principal = principal
      return
    }
    try {
      const payload = await request.jwtVerify<{ sub: string; tenantId: string }>()
      request.principal = { userId: payload.sub, tenantId: payload.tenantId }
    } catch {
      throw errors.unauthorized('authentication required')
    }
  })

  app.decorate('requireUser', async (request: FastifyRequest) => {
    try {
      const payload = await request.jwtVerify<{ sub: string; tenantId: string }>()
      request.principal = { userId: payload.sub, tenantId: payload.tenantId }
    } catch {
      throw errors.unauthorized('user authentication required')
    }
  })
}
