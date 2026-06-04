import { z } from 'zod/v4'
import { inboundContentSchema } from './inbound'

export const engineKindSchema = z.enum(['zapo', 'baileys'])
export type EngineKind = z.infer<typeof engineKindSchema>

export const engineStatusSchema = z.enum([
  'created',
  'connecting',
  'qr',
  'connected',
  'disconnected',
  'logged_out'
])
export type EngineStatus = z.infer<typeof engineStatusSchema>

export const messageAckStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'read',
  'played',
  'error'
])
export type MessageAckStatus = z.infer<typeof messageAckStatusSchema>

export const presenceStatusSchema = z.enum([
  'available',
  'unavailable',
  'composing',
  'recording',
  'paused'
])
export type PresenceStatus = z.infer<typeof presenceStatusSchema>

export const qrEventSchema = z.object({ type: z.literal('qr'), qr: z.string() })

export const connectionEventSchema = z.object({
  type: z.literal('connection'),
  status: engineStatusSchema,
  meJid: z.string().optional()
})

export const messageEventSchema = z.object({
  type: z.literal('message'),
  id: z.string().optional(),
  chat: z.string(),
  from: z.string(),
  fromMe: z.boolean(),
  isGroup: z.boolean(),
  participant: z.string().optional(),
  pushName: z.string().optional(),
  timestamp: z.number().optional(),
  content: inboundContentSchema
})

export const ackEventSchema = z.object({
  type: z.literal('ack'),
  ids: z.array(z.string()),
  chat: z.string(),
  fromMe: z.boolean().optional(),
  isGroup: z.boolean(),
  participant: z.string().optional(),
  status: messageAckStatusSchema,
  timestamp: z.number().optional()
})

export const presenceEventSchema = z.object({
  type: z.literal('presence'),
  chat: z.string(),
  from: z.string().optional(),
  status: presenceStatusSchema,
  lastSeen: z.number().nullable().optional()
})

export type QrEvent = z.infer<typeof qrEventSchema>
export type ConnectionEvent = z.infer<typeof connectionEventSchema>
export type MessageEvent = z.infer<typeof messageEventSchema>
export type AckEvent = z.infer<typeof ackEventSchema>
export type PresenceEvent = z.infer<typeof presenceEventSchema>

export const engineEventSchema = z.discriminatedUnion('type', [
  qrEventSchema,
  connectionEventSchema,
  messageEventSchema,
  ackEventSchema,
  presenceEventSchema
])
export type EngineEvent = z.infer<typeof engineEventSchema>
export type EngineEventType = EngineEvent['type']
