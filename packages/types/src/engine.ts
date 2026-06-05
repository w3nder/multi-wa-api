import { z } from 'zod/v4'
import { inboundContentSchema } from './inbound'
import { participantActionSchema } from './group'

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

export const quotedMessageSchema = z.object({
  id: z.string(),
  participant: z.string().optional(),
  content: inboundContentSchema.optional()
})
export type QuotedMessage = z.infer<typeof quotedMessageSchema>

export const messageEventSchema = z.object({
  type: z.literal('message'),
  id: z.string().optional(),
  chat: z.string(),
  from: z.string(),
  fromMe: z.boolean(),
  isGroup: z.boolean(),
  participant: z.string().optional(),
  fromAlt: z.string().optional(),
  pushName: z.string().optional(),
  timestamp: z.number().optional(),
  content: inboundContentSchema,
  mentions: z.array(z.string()).optional(),
  quoted: quotedMessageSchema.optional()
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

export const callStatusSchema = z.enum(['offer', 'accept', 'reject', 'terminate'])
export type CallStatus = z.infer<typeof callStatusSchema>

export const callEventSchema = z.object({
  type: z.literal('call'),
  status: callStatusSchema,
  id: z.string().optional(),
  from: z.string(),
  fromAlt: z.string().optional(),
  isGroup: z.boolean(),
  groupJid: z.string().optional(),
  isVideo: z.boolean().optional(),
  timestamp: z.number().optional()
})

export const groupParticipantsEventSchema = z.object({
  type: z.literal('group_participants'),
  chat: z.string(),
  action: participantActionSchema,
  participants: z.array(z.string()),
  author: z.string().optional(),
  authorAlt: z.string().optional(),
  timestamp: z.number().optional()
})

export const groupUpdateEventSchema = z.object({
  type: z.literal('group_update'),
  chat: z.string(),
  subject: z.string().optional(),
  description: z.string().optional(),
  announce: z.boolean().optional(),
  restrict: z.boolean().optional(),
  ephemeralSeconds: z.number().optional(),
  author: z.string().optional(),
  authorAlt: z.string().optional(),
  timestamp: z.number().optional()
})

export const membershipRequestActionSchema = z.enum(['created', 'revoked', 'rejected'])
export type MembershipRequestAction = z.infer<typeof membershipRequestActionSchema>

export const membershipRequestEventSchema = z.object({
  type: z.literal('membership_request'),
  chat: z.string(),
  action: membershipRequestActionSchema,
  participant: z.string(),
  participantAlt: z.string().optional(),
  author: z.string().optional(),
  authorAlt: z.string().optional(),
  timestamp: z.number().optional()
})

export type QrEvent = z.infer<typeof qrEventSchema>
export type ConnectionEvent = z.infer<typeof connectionEventSchema>
export type MessageEvent = z.infer<typeof messageEventSchema>
export type AckEvent = z.infer<typeof ackEventSchema>
export type PresenceEvent = z.infer<typeof presenceEventSchema>
export type CallEvent = z.infer<typeof callEventSchema>
export type GroupParticipantsEvent = z.infer<typeof groupParticipantsEventSchema>
export type GroupUpdateEvent = z.infer<typeof groupUpdateEventSchema>
export type MembershipRequestEvent = z.infer<typeof membershipRequestEventSchema>

export const engineEventSchema = z.discriminatedUnion('type', [
  qrEventSchema,
  connectionEventSchema,
  messageEventSchema,
  ackEventSchema,
  presenceEventSchema,
  callEventSchema,
  groupParticipantsEventSchema,
  groupUpdateEventSchema,
  membershipRequestEventSchema
])
export type EngineEvent = z.infer<typeof engineEventSchema>
export type EngineEventType = EngineEvent['type']
