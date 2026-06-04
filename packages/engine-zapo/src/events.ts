import type {
  AckEvent,
  InboundContent,
  InboundMedia,
  MessageAckStatus,
  MessageEvent,
  PresenceEvent,
  QuotedMessage
} from '@multi-wa/types'
import {
  getContentType,
  type WaIncomingAddonEvent,
  type WaIncomingChatstateEvent,
  type WaIncomingMessageEvent,
  type WaIncomingPresenceEvent,
  type WaIncomingReceiptEvent
} from 'zapo-js'

type ZapoMessage = NonNullable<WaIncomingMessageEvent['message']>

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return value
  if (typeof value === 'object' && 'toNumber' in value) {
    const fn = (value as { toNumber: unknown }).toNumber
    if (typeof fn === 'function') return (fn as () => number).call(value)
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us')
}

interface MediaLike {
  mimetype?: string | null
  fileLength?: unknown
  width?: number | null
  height?: number | null
  seconds?: number | null
  directPath?: string | null
  url?: string | null
  mediaKey?: Uint8Array | null
  fileEncSha256?: Uint8Array | null
  fileSha256?: Uint8Array | null
}

function toBase64(value: Uint8Array | null | undefined): string | undefined {
  if (!value) return undefined
  return Buffer.from(value).toString('base64')
}

function mapMedia(media: MediaLike | null | undefined): InboundMedia {
  return {
    mimetype: media?.mimetype ?? undefined,
    size: toNumber(media?.fileLength),
    width: media?.width ?? undefined,
    height: media?.height ?? undefined,
    seconds: media?.seconds ?? undefined,
    directPath: media?.directPath ?? undefined,
    url: media?.url ?? undefined,
    mediaKey: toBase64(media?.mediaKey),
    fileEncSha256: toBase64(media?.fileEncSha256),
    fileSha256: toBase64(media?.fileSha256)
  }
}

function unwrap(content: ZapoMessage): ZapoMessage {
  const type = getContentType(content)
  if (type === 'ephemeralMessage') return unwrap(content.ephemeralMessage?.message ?? {})
  if (type === 'viewOnceMessage') return unwrap(content.viewOnceMessage?.message ?? {})
  if (type === 'viewOnceMessageV2') return unwrap(content.viewOnceMessageV2?.message ?? {})
  if (type === 'viewOnceMessageV2Extension') {
    return unwrap(content.viewOnceMessageV2Extension?.message ?? {})
  }
  if (type === 'documentWithCaptionMessage') {
    return unwrap(content.documentWithCaptionMessage?.message ?? {})
  }
  if (type === 'editedMessage') return unwrap(content.editedMessage?.message ?? {})
  return content
}

interface ContextInfoLike {
  mentionedJid?: (string | null | undefined)[] | null
  stanzaId?: string | null
  participant?: string | null
  quotedMessage?: ZapoMessage | null
}

function extractContextInfo(content: ZapoMessage): ContextInfoLike | undefined {
  const type = getContentType(content)
  if (!type) return undefined
  const node = content[type as keyof ZapoMessage]
  if (node && typeof node === 'object' && 'contextInfo' in node) {
    return (node as { contextInfo?: ContextInfoLike | null }).contextInfo ?? undefined
  }
  return undefined
}

interface ContextFields {
  mentions?: string[]
  quoted?: QuotedMessage
}

export function mapZapoContext(message: ZapoMessage | null | undefined): ContextFields {
  if (!message) return {}
  const ctx = extractContextInfo(unwrap(message))
  if (!ctx) return {}
  const fields: ContextFields = {}
  const mentions = (ctx.mentionedJid ?? []).filter((jid): jid is string => Boolean(jid))
  if (mentions.length) fields.mentions = mentions
  if (ctx.stanzaId) {
    fields.quoted = {
      id: ctx.stanzaId,
      participant: ctx.participant ?? undefined,
      content: ctx.quotedMessage ? mapZapoContent(ctx.quotedMessage) : undefined
    }
  }
  return fields
}

export function mapZapoContent(message: ZapoMessage | null | undefined): InboundContent {
  if (!message) return { type: 'unknown' }
  const content = unwrap(message)
  const type = getContentType(content)

  switch (type) {
    case 'conversation':
      return { type: 'text', text: content.conversation ?? '' }
    case 'extendedTextMessage':
      return { type: 'text', text: content.extendedTextMessage?.text ?? '' }
    case 'imageMessage':
      return {
        type: 'image',
        media: mapMedia(content.imageMessage),
        caption: content.imageMessage?.caption ?? undefined
      }
    case 'videoMessage':
      return {
        type: 'video',
        media: mapMedia(content.videoMessage),
        caption: content.videoMessage?.caption ?? undefined,
        gif: content.videoMessage?.gifPlayback ?? undefined
      }
    case 'ptvMessage':
      return { type: 'video', media: mapMedia(content.ptvMessage) }
    case 'audioMessage':
      return {
        type: 'audio',
        media: mapMedia(content.audioMessage),
        voice: content.audioMessage?.ptt ?? undefined
      }
    case 'documentMessage':
      return {
        type: 'document',
        media: mapMedia(content.documentMessage),
        fileName: content.documentMessage?.fileName ?? undefined,
        caption: content.documentMessage?.caption ?? undefined,
        pageCount: content.documentMessage?.pageCount ?? undefined
      }
    case 'stickerMessage':
      return {
        type: 'sticker',
        media: mapMedia(content.stickerMessage),
        animated: content.stickerMessage?.isAnimated ?? undefined
      }
    case 'locationMessage':
      return {
        type: 'location',
        latitude: content.locationMessage?.degreesLatitude ?? 0,
        longitude: content.locationMessage?.degreesLongitude ?? 0,
        name: content.locationMessage?.name ?? undefined,
        address: content.locationMessage?.address ?? undefined
      }
    case 'liveLocationMessage':
      return {
        type: 'location',
        latitude: content.liveLocationMessage?.degreesLatitude ?? 0,
        longitude: content.liveLocationMessage?.degreesLongitude ?? 0
      }
    case 'contactMessage':
      return {
        type: 'contact',
        displayName: content.contactMessage?.displayName ?? undefined,
        vcard: content.contactMessage?.vcard ?? undefined
      }
    case 'reactionMessage':
      return {
        type: 'reaction',
        emoji: content.reactionMessage?.text ?? null,
        target: {
          id: content.reactionMessage?.key?.id ?? '',
          fromMe: content.reactionMessage?.key?.fromMe ?? undefined,
          participant: content.reactionMessage?.key?.participant ?? undefined
        }
      }
    case 'pollCreationMessage':
    case 'pollCreationMessageV2':
    case 'pollCreationMessageV3': {
      const poll =
        content.pollCreationMessage ??
        content.pollCreationMessageV2 ??
        content.pollCreationMessageV3
      return {
        type: 'poll',
        question: poll?.name ?? '',
        options: (poll?.options ?? []).map((option) => option.optionName ?? ''),
        selectableCount: poll?.selectableOptionsCount ?? undefined
      }
    }
    case 'buttonsResponseMessage':
      return {
        type: 'buttons_response',
        id: content.buttonsResponseMessage?.selectedButtonId ?? '',
        text: content.buttonsResponseMessage?.selectedDisplayText ?? undefined
      }
    case 'listResponseMessage':
      return {
        type: 'list_response',
        rowId: content.listResponseMessage?.singleSelectReply?.selectedRowId ?? '',
        title: content.listResponseMessage?.title ?? undefined,
        description: content.listResponseMessage?.description ?? undefined
      }
    default:
      return { type: 'unknown', kind: type }
  }
}

export function mapZapoMessageEvent(event: WaIncomingMessageEvent): MessageEvent {
  const chat = event.key.remoteJid ?? ''
  return {
    type: 'message',
    id: event.key.id ?? undefined,
    chat,
    from: event.key.participant ?? chat,
    fromMe: Boolean(event.key.fromMe),
    isGroup: event.key.isGroup,
    participant: event.key.participant ?? undefined,
    fromAlt: event.key.participantAlt ?? event.key.remoteJidAlt ?? undefined,
    pushName: event.pushName ?? undefined,
    timestamp: event.timestampSeconds ?? undefined,
    content: mapZapoContent(event.message),
    ...mapZapoContext(event.message)
  }
}

/**
 * Maps a decrypted reaction addon (`message_addon` with `kind: 'reaction'`) to
 * the same normalized reaction shape as a message event. `event.key` is the
 * envelope (who reacted); the reaction's `key`/`targetMessageId` is the target.
 * Returns null for non-reaction addons (poll votes, edits, ...).
 */
export function mapZapoReaction(event: WaIncomingAddonEvent): MessageEvent | null {
  const addon = event.decrypted
  if (!addon || addon.kind !== 'reaction') return null
  const reaction = addon.reaction
  const chat = event.key.remoteJid ?? ''
  return {
    type: 'message',
    id: event.key.id ?? undefined,
    chat,
    from: event.key.participant ?? chat,
    fromMe: Boolean(event.key.fromMe),
    isGroup: event.key.isGroup,
    participant: event.key.participant ?? undefined,
    fromAlt: event.key.participantAlt ?? event.key.remoteJidAlt ?? undefined,
    content: {
      type: 'reaction',
      emoji: reaction.text ?? null,
      target: {
        id: event.targetMessageId,
        fromMe: reaction.key?.fromMe ?? undefined,
        participant: reaction.key?.participant ?? undefined
      }
    }
  }
}

function mapZapoReceiptStatus(status: string): MessageAckStatus | null {
  switch (status) {
    case 'delivered':
      return 'delivered'
    case 'read':
      return 'read'
    case 'played':
      return 'played'
    default:
      return null
  }
}

export function mapZapoReceipt(event: WaIncomingReceiptEvent): AckEvent | null {
  const status = mapZapoReceiptStatus(event.status)
  if (!status) return null
  const chat = event.chatJid ?? ''
  return {
    type: 'ack',
    ids: [...event.messageIds],
    chat,
    isGroup: isGroupJid(chat),
    participant: event.participantJid ?? undefined,
    status
  }
}

export function mapZapoPresence(event: WaIncomingPresenceEvent): PresenceEvent {
  const chat = event.chatJid ?? ''
  return {
    type: 'presence',
    chat,
    status: event.type === 'available' ? 'available' : 'unavailable',
    lastSeen: event.lastSeen?.kind === 'timestamp' ? event.lastSeen.unixSeconds : null
  }
}

export function mapZapoChatstate(event: WaIncomingChatstateEvent): PresenceEvent {
  const chat = event.chatJid ?? ''
  const status =
    event.state === 'composing' ? (event.media === 'audio' ? 'recording' : 'composing') : 'paused'
  return {
    type: 'presence',
    chat,
    from: event.participantJid ?? undefined,
    status
  }
}
