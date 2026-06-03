import { sendMessageInputSchema } from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'
import { parse } from '../validation'

export function messageRoutes(app: FastifyInstance, container: Container): void {
  app.post('/:id/messages', async (request) => {
    const { id } = request.params as { id: string }
    await container.sessionService.get(request.principal.tenantId, id)
    const input = parse(sendMessageInputSchema, request.body)
    return container.messagingService.send(id, input)
  })
}
