import { createWebhookInputSchema } from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'
import { parse } from '../validation'

export function webhookRoutes(app: FastifyInstance, container: Container): void {
  app.post('/', async (request, reply) => {
    const input = parse(createWebhookInputSchema, request.body)
    const webhook = await container.webhookService.create(request.principal.tenantId, input)
    return reply.status(201).send(webhook)
  })

  app.get('/', async (request) => container.webhookService.list(request.principal.tenantId))

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await container.webhookService.delete(request.principal.tenantId, id)
    return reply.status(204).send()
  })
}
