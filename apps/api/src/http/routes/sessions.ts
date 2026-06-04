import {
  createSessionInputSchema,
  migrateSessionInputSchema,
  qrSchema,
  sessionSchema
} from '@multi-wa/types'
import QRCode from 'qrcode'
import { z } from 'zod/v4'
import type { Container } from '../../container'
import { SECURITY } from '../openapi'
import { streamEvents } from '../sse'
import type { AppInstance } from '../types'

const idParam = z.object({ id: z.uuid() })

const migrationResultSchema = z.object({
  session: sessionSchema,
  losses: z.array(z.object({ domain: z.string(), severity: z.string(), count: z.number() }))
})

export function sessionRoutes(app: AppInstance, container: Container): void {
  app.post(
    '/',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Create and start a session',
        security: SECURITY,
        body: createSessionInputSchema,
        response: { 201: sessionSchema }
      }
    },
    async (request, reply) => {
      const session = await container.sessionService.create(
        request.principal.tenantId,
        request.body
      )
      return reply.status(201).send(session)
    }
  )

  app.get(
    '/',
    {
      schema: {
        tags: ['sessions'],
        summary: 'List sessions',
        security: SECURITY,
        response: { 200: z.array(sessionSchema) }
      }
    },
    async (request) => container.sessionService.list(request.principal.tenantId)
  )

  app.get(
    '/:id',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Get a session',
        security: SECURITY,
        params: idParam,
        response: { 200: sessionSchema }
      }
    },
    async (request) => container.sessionService.get(request.principal.tenantId, request.params.id)
  )

  app.get(
    '/:id/qr',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Get the pairing QR (string + data URL)',
        security: SECURITY,
        params: idParam,
        response: { 200: qrSchema }
      }
    },
    async (request) => {
      const qr = await container.sessionService.getQr(request.principal.tenantId, request.params.id)
      return { qr, dataUrl: qr ? await QRCode.toDataURL(qr) : null }
    }
  )

  app.get(
    '/:id/events',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Stream session events (Server-Sent Events)',
        description: 'Emits qr, status and message events as text/event-stream.',
        security: SECURITY,
        params: idParam
      }
    },
    async (request, reply) => {
      await container.sessionService.connect(request.principal.tenantId, request.params.id)
      streamEvents(request, reply, container.manager, request.params.id)
    }
  )

  app.post(
    '/:id/connect',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Connect a session',
        security: SECURITY,
        params: idParam,
        response: { 200: sessionSchema }
      }
    },
    async (request) =>
      container.sessionService.connect(request.principal.tenantId, request.params.id)
  )

  app.post(
    '/:id/disconnect',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Disconnect a session (keeps credentials)',
        security: SECURITY,
        params: idParam,
        response: { 200: sessionSchema }
      }
    },
    async (request) =>
      container.sessionService.disconnect(request.principal.tenantId, request.params.id)
  )

  app.post(
    '/:id/logout',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Logout a session (wipes credentials)',
        security: SECURITY,
        params: idParam,
        response: { 200: sessionSchema }
      }
    },
    async (request) =>
      container.sessionService.logout(request.principal.tenantId, request.params.id)
  )

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Delete a session',
        security: SECURITY,
        params: idParam,
        response: { 204: z.null() }
      }
    },
    async (request, reply) => {
      await container.sessionService.remove(request.principal.tenantId, request.params.id)
      return reply.status(204).send(null)
    }
  )

  app.post(
    '/:id/migrate',
    {
      schema: {
        tags: ['sessions'],
        summary: 'Migrate a session to another engine without re-pairing',
        security: SECURITY,
        params: idParam,
        body: migrateSessionInputSchema,
        response: { 200: migrationResultSchema }
      }
    },
    async (request) =>
      container.sessionService.migrate(
        request.principal.tenantId,
        request.params.id,
        request.body.to
      )
  )
}
