import {
  apiKeyCreatedSchema,
  apiKeySchema,
  createApiKeyInputSchema,
  loginInputSchema,
  refreshInputSchema,
  tokenPairSchema,
  type TokenPair
} from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'
import { arrayOf, ID_PARAMS, jsonSchema, NO_CONTENT, routeSchema } from '../openapi'
import { parse } from '../validation'

function signAccess(
  app: FastifyInstance,
  container: Container,
  userId: string,
  tenantId: string
): string {
  return app.jwt.sign({ sub: userId, tenantId }, { expiresIn: container.config.JWT_ACCESS_TTL })
}

export function authRoutes(app: FastifyInstance, container: Container): void {
  app.post(
    '/login',
    {
      schema: routeSchema({
        tags: ['auth'],
        summary: 'Login with email and password',
        description: 'Returns a short-lived access token and a rotating refresh token.',
        body: loginInputSchema,
        response: { 200: jsonSchema(tokenPairSchema) }
      })
    },
    async (request): Promise<TokenPair> => {
      const input = parse(loginInputSchema, request.body)
      const principal = await container.authService.verifyCredentials(input.email, input.password)
      const accessToken = signAccess(app, container, principal.userId, principal.tenantId)
      const refreshToken = await container.authService.issueRefreshToken(principal.userId)
      return { accessToken, refreshToken, expiresIn: container.config.JWT_ACCESS_TTL }
    }
  )

  app.post(
    '/refresh',
    {
      schema: routeSchema({
        tags: ['auth'],
        summary: 'Rotate a refresh token',
        body: refreshInputSchema,
        response: { 200: jsonSchema(tokenPairSchema) }
      })
    },
    async (request): Promise<TokenPair> => {
      const input = parse(refreshInputSchema, request.body)
      const rotation = await container.authService.rotateRefreshToken(input.refreshToken)
      const accessToken = signAccess(app, container, rotation.userId, rotation.tenantId)
      return {
        accessToken,
        refreshToken: rotation.token,
        expiresIn: container.config.JWT_ACCESS_TTL
      }
    }
  )

  app.post(
    '/api-keys',
    {
      preHandler: app.requireUser,
      schema: routeSchema({
        tags: ['auth'],
        summary: 'Create an API key',
        description: 'The plaintext key is returned once and cannot be retrieved again.',
        body: createApiKeyInputSchema,
        secured: true,
        response: { 201: jsonSchema(apiKeyCreatedSchema) }
      })
    },
    async (request, reply) => {
      const input = parse(createApiKeyInputSchema, request.body)
      const apiKey = await container.authService.createApiKey(
        request.principal.tenantId,
        input.name
      )
      return reply.status(201).send(apiKey)
    }
  )

  app.get(
    '/api-keys',
    {
      preHandler: app.requireUser,
      schema: routeSchema({
        tags: ['auth'],
        summary: 'List API keys',
        secured: true,
        response: { 200: arrayOf(apiKeySchema) }
      })
    },
    async (request) => container.authService.listApiKeys(request.principal.tenantId)
  )

  app.delete(
    '/api-keys/:id',
    {
      preHandler: app.requireUser,
      schema: routeSchema({
        tags: ['auth'],
        summary: 'Revoke an API key',
        params: ID_PARAMS,
        secured: true,
        response: { 204: NO_CONTENT }
      })
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await container.authService.revokeApiKey(request.principal.tenantId, id)
      return reply.status(204).send()
    }
  )
}
