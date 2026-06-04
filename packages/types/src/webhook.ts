import { z } from 'zod/v4'

export const webhookEventTypeSchema = z
  .enum(['qr', 'connection', 'message', 'ack', 'presence'])
  .meta({
    description:
      'qr: new QR code to scan. connection: channel/connection state (connecting, qr, connected, disconnected, logged_out). message: inbound/outbound messages of any type (text, image, video, audio, document, sticker, location, contact, reaction, poll, buttons_response, list_response), including groups. ack: message delivery status (pending, sent, delivered, read, played, error). presence: chat presence (available, unavailable, composing, recording, paused).'
  })
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>

export const createWebhookInputSchema = z.object({
  url: z.url(),
  events: z
    .array(webhookEventTypeSchema)
    .min(1)
    .meta({ examples: [['qr', 'connection', 'message', 'ack', 'presence']] }),
  secret: z.string().min(16).max(256).optional()
})
export type CreateWebhookInput = z.infer<typeof createWebhookInputSchema>

export const webhookSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  events: z.array(webhookEventTypeSchema),
  active: z.boolean(),
  createdAt: z.string()
})
export type Webhook = z.infer<typeof webhookSchema>

export const webhookCreatedSchema = webhookSchema.extend({
  secret: z.string()
})
export type WebhookCreated = z.infer<typeof webhookCreatedSchema>
