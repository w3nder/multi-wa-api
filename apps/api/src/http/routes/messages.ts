import { sendMessageInputSchema, sendMessageResultSchema } from '@multi-wa/types'
import { z } from 'zod/v4'
import type { Container } from '../../container'
import { SECURITY } from '../openapi'
import type { AppInstance } from '../types'

const idParam = z.object({ id: z.uuid() })

export function messageRoutes(app: AppInstance, container: Container): void {
  app.post(
    '/:id/messages',
    {
      schema: {
        tags: ['messages'],
        summary: 'Send a normalized message',
        description:
          'Engine-agnostic content. content.type is one of text, image, video, audio, document, sticker, location, contact.',
        security: SECURITY,
        params: idParam,
        body: sendMessageInputSchema,
        response: { 200: sendMessageResultSchema }
      }
    },
    async (request) => {
      await container.sessionService.get(request.principal.tenantId, request.params.id)
      return container.messagingService.send(request.params.id, request.body)
    }
  )
}
