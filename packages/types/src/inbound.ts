import { z } from 'zod/v4'

export const inboundMediaSchema = z.object({
  mimetype: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  seconds: z.number().optional()
})
export type InboundMedia = z.infer<typeof inboundMediaSchema>

export const inboundReactionTargetSchema = z.object({
  id: z.string(),
  fromMe: z.boolean().optional(),
  participant: z.string().optional()
})

export const inboundTextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string()
})

export const inboundImageContentSchema = z.object({
  type: z.literal('image'),
  media: inboundMediaSchema,
  caption: z.string().optional()
})

export const inboundVideoContentSchema = z.object({
  type: z.literal('video'),
  media: inboundMediaSchema,
  caption: z.string().optional(),
  gif: z.boolean().optional()
})

export const inboundAudioContentSchema = z.object({
  type: z.literal('audio'),
  media: inboundMediaSchema,
  voice: z.boolean().optional()
})

export const inboundDocumentContentSchema = z.object({
  type: z.literal('document'),
  media: inboundMediaSchema,
  fileName: z.string().optional(),
  caption: z.string().optional(),
  pageCount: z.number().optional()
})

export const inboundStickerContentSchema = z.object({
  type: z.literal('sticker'),
  media: inboundMediaSchema,
  animated: z.boolean().optional()
})

export const inboundLocationContentSchema = z.object({
  type: z.literal('location'),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional()
})

export const inboundContactContentSchema = z.object({
  type: z.literal('contact'),
  displayName: z.string().optional(),
  vcard: z.string().optional()
})

export const inboundReactionContentSchema = z.object({
  type: z.literal('reaction'),
  emoji: z.string().nullable(),
  target: inboundReactionTargetSchema
})

export const inboundPollContentSchema = z.object({
  type: z.literal('poll'),
  question: z.string(),
  options: z.array(z.string()),
  selectableCount: z.number().optional()
})

export const inboundButtonsResponseContentSchema = z.object({
  type: z.literal('buttons_response'),
  id: z.string(),
  text: z.string().optional()
})

export const inboundListResponseContentSchema = z.object({
  type: z.literal('list_response'),
  rowId: z.string(),
  title: z.string().optional(),
  description: z.string().optional()
})

export const inboundUnknownContentSchema = z.object({
  type: z.literal('unknown'),
  kind: z.string().optional()
})

export const inboundContentSchema = z.discriminatedUnion('type', [
  inboundTextContentSchema,
  inboundImageContentSchema,
  inboundVideoContentSchema,
  inboundAudioContentSchema,
  inboundDocumentContentSchema,
  inboundStickerContentSchema,
  inboundLocationContentSchema,
  inboundContactContentSchema,
  inboundReactionContentSchema,
  inboundPollContentSchema,
  inboundButtonsResponseContentSchema,
  inboundListResponseContentSchema,
  inboundUnknownContentSchema
])
export type InboundContent = z.infer<typeof inboundContentSchema>
export type InboundContentType = InboundContent['type']
