import type {
  AckEvent,
  InboundContent,
  InboundMedia,
  MessageAckStatus,
  MessageEvent,
  PresenceEvent
} from '@multi-wa/types'
import {
  getContentType,
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
}

function mapMedia(media: MediaLike | null | undefined): InboundMedia {
  return {
    mimetype: media?.mimetype ?? undefined,
    size: toNumber(media?.fileLength),
    width: media?.width ?? undefined,
    height: media?.height ?? undefined,
    seconds: media?.seconds ?? undefined
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
    pushName: event.pushName ?? undefined,
    timestamp: event.timestampSeconds ?? undefined,
    content: mapZapoContent(event.message)
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
