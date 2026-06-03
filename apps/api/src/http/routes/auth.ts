import {
  createApiKeyInputSchema,
  loginInputSchema,
  refreshInputSchema,
  type TokenPair
} from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'
import { parse } from '../validation'

function signAccess(app: FastifyInstance, container: Container, userId: string, tenantId: string): string {
  return app.jwt.sign({ sub: userId, tenantId }, { expiresIn: container.config.JWT_ACCESS_TTL })
}

export function authRoutes(app: FastifyInstance, container: Container): void {
  app.post('/login', async (request): Promise<TokenPair> => {
    const input = parse(loginInputSchema, request.body)
    const principal = await container.authService.verifyCredentials(input.email, input.password)
    const accessToken = signAccess(app, container, principal.userId, principal.tenantId)
    const refreshToken = await container.authService.issueRefreshToken(principal.userId)
    return { accessToken, refreshToken, expiresIn: container.config.JWT_ACCESS_TTL }
  })

  app.post('/refresh', async (request): Promise<TokenPair> => {
    const input = parse(refreshInputSchema, request.body)
    const rotation = await container.authService.rotateRefreshToken(input.refreshToken)
    const accessToken = signAccess(app, container, rotation.userId, rotation.tenantId)
    return { accessToken, refreshToken: rotation.token, expiresIn: container.config.JWT_ACCESS_TTL }
  })

  app.post('/api-keys', { preHandler: app.requireUser }, async (request, reply) => {
    const input = parse(createApiKeyInputSchema, request.body)
    const apiKey = await container.authService.createApiKey(request.principal.tenantId, input.name)
    return reply.status(201).send(apiKey)
  })

  app.get('/api-keys', { preHandler: app.requireUser }, async (request) =>
    container.authService.listApiKeys(request.principal.tenantId)
  )

  app.delete('/api-keys/:id', { preHandler: app.requireUser }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await container.authService.revokeApiKey(request.principal.tenantId, id)
    return reply.status(204).send()
  })
}
