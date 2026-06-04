import { createWebhookInputSchema, webhookCreatedSchema, webhookSchema } from '@multi-wa/types'
import { z } from 'zod/v4'
import type { Container } from '../../container'
import { SECURITY } from '../openapi'
import type { AppInstance } from '../types'

const idParam = z.object({ id: z.uuid() })

export function webhookRoutes(app: AppInstance, container: Container): void {
  app.post(
    '/',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Register a webhook',
        description: 'Deliveries are signed with HMAC-SHA256 in the X-Signature header.',
        security: SECURITY,
        body: createWebhookInputSchema,
        response: { 201: webhookCreatedSchema }
      }
    },
    async (request, reply) => {
      const webhook = await container.webhookService.create(
        request.principal.tenantId,
        request.body
      )
      return reply.status(201).send(webhook)
    }
  )

  app.get(
    '/',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'List webhooks',
        security: SECURITY,
        response: { 200: z.array(webhookSchema) }
      }
    },
    async (request) => container.webhookService.list(request.principal.tenantId)
  )

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Delete a webhook',
        security: SECURITY,
        params: idParam,
        response: { 204: z.null() }
      }
    },
    async (request, reply) => {
      await container.webhookService.delete(request.principal.tenantId, request.params.id)
      return reply.status(204).send(null)
    }
  )
}
