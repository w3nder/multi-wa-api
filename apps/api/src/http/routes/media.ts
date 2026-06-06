import { downloadMediaInputSchema } from '@multi-wa/types'
import { z } from 'zod/v4'
import type { Container } from '../../container'
import { SECURITY } from '../openapi'
import type { AppInstance } from '../types'

const idParam = z.object({ id: z.uuid() })

export function mediaRoutes(app: AppInstance, container: Container): void {
  app.post(
    '/:id/media/download',
    {
      schema: {
        tags: ['media'],
        summary: 'Download media bytes from a normalized media reference',
        description:
          'Pass the { type, media } object received in a message webhook (media types) to fetch the decrypted bytes. Responds with the raw media stream.',
        security: SECURITY,
        params: idParam,
        body: downloadMediaInputSchema
      }
    },
    async (request, reply) => {
      await container.sessionService.get(request.principal.tenantId, request.params.id)
      const stream = await container.mediaService.download(
        request.principal.tenantId,
        request.params.id,
        request.body
      )
      reply.header('content-type', request.body.media.mimetype ?? 'application/octet-stream')
      return reply.send(stream)
    }
  )
}
