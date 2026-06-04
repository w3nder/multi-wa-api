import {
  apiKeyCreatedSchema,
  apiKeySchema,
  createApiKeyInputSchema,
  loginInputSchema,
  refreshInputSchema,
  tokenPairSchema
} from '@multi-wa/types'
import { z } from 'zod/v4'
import type { Container } from '../../container'
import { SECURITY } from '../openapi'
import type { AppInstance } from '../types'

const idParam = z.object({ id: z.uuid() })

function signAccess(
  app: AppInstance,
  container: Container,
  userId: string,
  tenantId: string
): string {
  return app.jwt.sign({ sub: userId, tenantId }, { expiresIn: container.config.JWT_ACCESS_TTL })
}

export function authRoutes(app: AppInstance, container: Container): void {
  app.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Login with email and password',
        description: 'Returns a short-lived access token and a rotating refresh token.',
        body: loginInputSchema,
        response: { 200: tokenPairSchema }
      }
    },
    async (request) => {
      const principal = await container.authService.verifyCredentials(
        request.body.email,
        request.body.password
      )
      const accessToken = signAccess(app, container, principal.userId, principal.tenantId)
      const refreshToken = await container.authService.issueRefreshToken(principal.userId)
      return { accessToken, refreshToken, expiresIn: container.config.JWT_ACCESS_TTL }
    }
  )

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rotate a refresh token',
        body: refreshInputSchema,
        response: { 200: tokenPairSchema }
      }
    },
    async (request) => {
      const rotation = await container.authService.rotateRefreshToken(request.body.refreshToken)
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
      schema: {
        tags: ['auth'],
        summary: 'Create an API key',
        description: 'The plaintext key is returned once and cannot be retrieved again.',
        security: SECURITY,
        body: createApiKeyInputSchema,
        response: { 201: apiKeyCreatedSchema }
      }
    },
    async (request, reply) => {
      const apiKey = await container.authService.createApiKey(
        request.principal.tenantId,
        request.body.name
      )
      return reply.status(201).send(apiKey)
    }
  )

  app.get(
    '/api-keys',
    {
      preHandler: app.requireUser,
      schema: {
        tags: ['auth'],
        summary: 'List API keys',
        security: SECURITY,
        response: { 200: z.array(apiKeySchema) }
      }
    },
    async (request) => container.authService.listApiKeys(request.principal.tenantId)
  )

  app.delete(
    '/api-keys/:id',
    {
      preHandler: app.requireUser,
      schema: {
        tags: ['auth'],
        summary: 'Revoke an API key',
        security: SECURITY,
        params: idParam,
        response: { 204: z.null() }
      }
    },
    async (request, reply) => {
      await container.authService.revokeApiKey(request.principal.tenantId, request.params.id)
      return reply.status(204).send(null)
    }
  )
}
