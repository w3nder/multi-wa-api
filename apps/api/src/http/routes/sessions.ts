import { createSessionInputSchema, migrateSessionInputSchema } from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import type { Container } from '../../container'
import { streamEvents } from '../sse'
import { parse } from '../validation'

export function sessionRoutes(app: FastifyInstance, container: Container): void {
  app.post('/', async (request, reply) => {
    const input = parse(createSessionInputSchema, request.body)
    const session = await container.sessionService.create(request.principal.tenantId, input)
    return reply.status(201).send(session)
  })

  app.get('/', async (request) => container.sessionService.list(request.principal.tenantId))

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string }
    return container.sessionService.get(request.principal.tenantId, id)
  })

  app.get('/:id/qr', async (request) => {
    const { id } = request.params as { id: string }
    const qr = await container.sessionService.getQr(request.principal.tenantId, id)
    return { qr, dataUrl: qr ? await QRCode.toDataURL(qr) : null }
  })

  app.get('/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string }
    await container.sessionService.connect(request.principal.tenantId, id)
    streamEvents(request, reply, container.manager, id)
  })

  app.post('/:id/connect', async (request) => {
    const { id } = request.params as { id: string }
    return container.sessionService.connect(request.principal.tenantId, id)
  })

  app.post('/:id/disconnect', async (request) => {
    const { id } = request.params as { id: string }
    return container.sessionService.disconnect(request.principal.tenantId, id)
  })

  app.post('/:id/logout', async (request) => {
    const { id } = request.params as { id: string }
    return container.sessionService.logout(request.principal.tenantId, id)
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await container.sessionService.remove(request.principal.tenantId, id)
    return reply.status(204).send()
  })

  app.post('/:id/migrate', async (request) => {
    const { id } = request.params as { id: string }
    const input = parse(migrateSessionInputSchema, request.body)
    return container.sessionService.migrate(request.principal.tenantId, id, input.to)
  })
}
