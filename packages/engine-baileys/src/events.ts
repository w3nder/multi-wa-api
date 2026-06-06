import type {
  AckEvent,
  CallEvent,
  CallStatus,
  GroupParticipantsEvent,
  GroupUpdateEvent,
  InboundContent,
  InboundMedia,
  MembershipRequestAction,
  MembershipRequestEvent,
  MessageAckStatus,
  MessageEditEvent,
  MessageEvent,
  ParticipantAction,
  PresenceEvent,
  PresenceStatus,
  QuotedMessage
} from '@multi-wa/types'
import {
  getContentType,
  normalizeMessageContent,
  proto,
  type WAMessage,
  type WAMessageKey
} from 'baileys'

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

function unwrap(content: proto.IMessage): proto.IMessage {
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

function extractContextInfo(content: proto.IMessage): proto.IContextInfo | null | undefined {
  const type = getContentType(content)
  if (!type) return undefined
  const node = content[type as keyof proto.IMessage]
  if (node && typeof node === 'object' && 'contextInfo' in node) {
    return (node as { contextInfo?: proto.IContextInfo | null }).contextInfo
  }
  return undefined
}

interface ContextFields {
  mentions?: string[]
  quoted?: QuotedMessage
}

export function mapBaileysContext(message: proto.IMessage | null | undefined): ContextFields {
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
      content: ctx.quotedMessage ? mapBaileysContent(ctx.quotedMessage) : undefined
    }
  }
  return fields
}

export function mapBaileysContent(message: proto.IMessage | null | undefined): InboundContent {
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

export function mapBaileysMessageEvent(message: WAMessage): MessageEvent {
  const chat = message.key.remoteJid ?? ''
  return {
    type: 'message',
    id: message.key.id ?? undefined,
    chat,
    from: message.key.participant ?? chat,
    fromMe: Boolean(message.key.fromMe),
    isGroup: isGroupJid(chat),
    participant: message.key.participant ?? undefined,
    fromAlt: message.key.participantAlt ?? message.key.remoteJidAlt ?? undefined,
    pushName: message.pushName ?? undefined,
    timestamp: toNumber(message.messageTimestamp),
    content: mapBaileysContent(message.message),
    ...mapBaileysContext(message.message)
  }
}

export function isBaileysEditUpsert(message: WAMessage): boolean {
  const protocolMessage = normalizeMessageContent(message.message)?.protocolMessage
  return (
    protocolMessage?.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT &&
    protocolMessage.editedMessage != null
  )
}

export function isBaileysProtocolMessage(message: WAMessage): boolean {
  return normalizeMessageContent(message.message)?.protocolMessage != null
}

export function mapBaileysEdit(message: WAMessage): MessageEditEvent {
  const protocolMessage = normalizeMessageContent(message.message)?.protocolMessage
  const edited = protocolMessage?.editedMessage ?? undefined
  const chat = message.key.remoteJid ?? ''
  const editedMs = toNumber(protocolMessage?.timestampMs)
  return {
    type: 'message_edit',
    id: protocolMessage?.key?.id ?? message.key.id ?? '',
    chat,
    from: message.key.participant ?? chat,
    fromMe: Boolean(message.key.fromMe),
    isGroup: isGroupJid(chat),
    participant: message.key.participant ?? undefined,
    fromAlt: message.key.participantAlt ?? message.key.remoteJidAlt ?? undefined,
    timestamp:
      editedMs !== undefined ? Math.floor(editedMs / 1000) : toNumber(message.messageTimestamp),
    content: mapBaileysContent(edited),
    ...mapBaileysContext(edited)
  }
}

/**
 * True when an upserted message is a reaction (plain or encrypted). These are
 * delivered through the dedicated `messages.reaction` event instead, so the
 * upsert path skips them to avoid emitting a duplicate (or an `unknown`).
 */
export function isBaileysReactionUpsert(message: WAMessage): boolean {
  if (!message.message) return false
  const type = getContentType(unwrap(message.message))
  return type === 'reactionMessage' || type === 'encReactionMessage'
}

/**
 * Maps baileys' `messages.reaction` payload to the same normalized reaction
 * shape the upsert path produced. `entry.key` is the reacted-to message
 * (target); `entry.reaction.key` is the envelope (who reacted).
 */
export function mapBaileysReaction(entry: {
  key: WAMessageKey
  reaction: proto.IReaction
}): MessageEvent {
  const target = entry.key
  const envelope = (entry.reaction.key ?? {}) as WAMessageKey
  const chat = envelope.remoteJid ?? ''
  const senderMs = toNumber(entry.reaction.senderTimestampMs)
  return {
    type: 'message',
    id: envelope.id ?? undefined,
    chat,
    from: envelope.participant ?? chat,
    fromMe: Boolean(envelope.fromMe),
    isGroup: isGroupJid(chat),
    participant: envelope.participant ?? undefined,
    fromAlt: envelope.participantAlt ?? envelope.remoteJidAlt ?? undefined,
    timestamp: senderMs === undefined ? undefined : Math.floor(senderMs / 1000),
    content: {
      type: 'reaction',
      emoji: entry.reaction.text ?? null,
      target: {
        id: target?.id ?? '',
        fromMe: target?.fromMe ?? undefined,
        participant: target?.participant ?? undefined
      }
    }
  }
}

export function mapBaileysAckStatus(status: number): MessageAckStatus {
  switch (status) {
    case 0:
      return 'error'
    case 1:
      return 'pending'
    case 2:
      return 'sent'
    case 3:
      return 'delivered'
    case 4:
      return 'read'
    case 5:
      return 'played'
    default:
      return 'pending'
  }
}

export function mapBaileysAck(entry: {
  key: WAMessageKey
  update: { status?: number | null }
}): AckEvent | null {
  const status = entry.update?.status
  if (status === null || status === undefined) return null
  const chat = entry.key.remoteJid ?? ''
  return {
    type: 'ack',
    ids: entry.key.id ? [entry.key.id] : [],
    chat,
    fromMe: entry.key.fromMe ?? undefined,
    isGroup: isGroupJid(chat),
    participant: entry.key.participant ?? undefined,
    status: mapBaileysAckStatus(Number(status))
  }
}

export function mapBaileysReceipt(entry: {
  key: WAMessageKey
  receipt: {
    userJid?: string | null
    receiptTimestamp?: unknown
    readTimestamp?: unknown
    playedTimestamp?: unknown
  }
}): AckEvent | null {
  const receipt = entry.receipt
  let status: MessageAckStatus | null = null
  let timestamp: number | undefined
  if (receipt.playedTimestamp) {
    status = 'played'
    timestamp = toNumber(receipt.playedTimestamp)
  } else if (receipt.readTimestamp) {
    status = 'read'
    timestamp = toNumber(receipt.readTimestamp)
  } else if (receipt.receiptTimestamp) {
    status = 'delivered'
    timestamp = toNumber(receipt.receiptTimestamp)
  }
  if (!status) return null
  const chat = entry.key.remoteJid ?? ''
  return {
    type: 'ack',
    ids: entry.key.id ? [entry.key.id] : [],
    chat,
    fromMe: entry.key.fromMe ?? undefined,
    isGroup: isGroupJid(chat),
    participant: receipt.userJid ?? entry.key.participant ?? undefined,
    status,
    timestamp
  }
}

function mapPresenceStatus(presence: string | null | undefined): PresenceStatus {
  switch (presence) {
    case 'available':
    case 'composing':
    case 'recording':
    case 'paused':
      return presence
    default:
      return 'unavailable'
  }
}

export function mapBaileysPresence(update: {
  id: string
  presences?: Record<string, { lastKnownPresence?: string | null; lastSeen?: number | null }>
}): PresenceEvent[] {
  const chat = update.id
  return Object.entries(update.presences ?? {}).map(([participant, data]) => ({
    type: 'presence',
    chat,
    from: participant,
    status: mapPresenceStatus(data.lastKnownPresence),
    lastSeen: data.lastSeen ?? null
  }))
}

type BaileysCallInput = {
  from?: string | null
  callerPn?: string | null
  id?: string | null
  isGroup?: boolean | null
  groupJid?: string | null
  isVideo?: boolean | null
  date?: Date | null
  status?: string | null
}

const BAILEYS_CALL_STATUS: Record<string, CallStatus | undefined> = {
  offer: 'offer',
  accept: 'accept',
  reject: 'reject',
  terminate: 'terminate',
  timeout: 'terminate'
}

export function mapBaileysCall(call: BaileysCallInput): CallEvent | null {
  const status = call.status ? BAILEYS_CALL_STATUS[call.status] : undefined
  if (!status || !call.from) return null
  return {
    type: 'call',
    status,
    id: call.id ?? undefined,
    from: call.from,
    fromAlt: call.callerPn ?? undefined,
    isGroup: call.isGroup ?? false,
    groupJid: call.groupJid ?? undefined,
    isVideo: call.isVideo ?? undefined,
    timestamp: call.date ? Math.floor(call.date.getTime() / 1000) : undefined
  }
}

type BaileysParticipantInput = { id?: string | null } | null

type BaileysParticipantsInput = {
  id?: string | null
  author?: string | null
  authorPn?: string | null
  action?: string | null
  participants?: BaileysParticipantInput[] | null
}

const PARTICIPANT_ACTIONS = new Set(['add', 'remove', 'promote', 'demote'])

export function mapBaileysGroupParticipants(
  update: BaileysParticipantsInput
): GroupParticipantsEvent | null {
  if (!update.id || !update.action || !PARTICIPANT_ACTIONS.has(update.action)) return null
  const participants = (update.participants ?? [])
    .map((p) => p?.id)
    .filter((id): id is string => Boolean(id))
  if (participants.length === 0) return null
  return {
    type: 'group_participants',
    chat: update.id,
    action: update.action as ParticipantAction,
    participants,
    author: update.author ?? undefined,
    authorAlt: update.authorPn ?? undefined
  }
}

type BaileysGroupUpdateInput = {
  id?: string | null
  subject?: string | null
  desc?: string | null
  announce?: boolean | null
  restrict?: boolean | null
  ephemeralDuration?: number | null
  author?: string | null
  authorPn?: string | null
}

export function mapBaileysGroupUpdate(update: BaileysGroupUpdateInput): GroupUpdateEvent | null {
  if (!update.id) return null
  const event: GroupUpdateEvent = { type: 'group_update', chat: update.id }
  if (update.subject != null) event.subject = update.subject
  if (update.desc != null) event.description = update.desc
  if (update.announce != null) event.announce = update.announce
  if (update.restrict != null) event.restrict = update.restrict
  if (update.ephemeralDuration != null) event.ephemeralSeconds = update.ephemeralDuration
  if (update.author != null) event.author = update.author
  if (update.authorPn != null) event.authorAlt = update.authorPn
  const hasField =
    event.subject !== undefined ||
    event.description !== undefined ||
    event.announce !== undefined ||
    event.restrict !== undefined ||
    event.ephemeralSeconds !== undefined
  return hasField ? event : null
}

type BaileysJoinRequestInput = {
  id?: string | null
  author?: string | null
  authorPn?: string | null
  participant?: string | null
  participantPn?: string | null
  action?: string | null
}

const MEMBERSHIP_ACTIONS = new Set(['created', 'revoked', 'rejected'])

export function mapBaileysMembershipRequest(
  update: BaileysJoinRequestInput
): MembershipRequestEvent | null {
  if (!update.id || !update.participant || !update.action || !MEMBERSHIP_ACTIONS.has(update.action)) {
    return null
  }
  return {
    type: 'membership_request',
    chat: update.id,
    action: update.action as MembershipRequestAction,
    participant: update.participant,
    participantAlt: update.participantPn ?? undefined,
    author: update.author ?? undefined,
    authorAlt: update.authorPn ?? undefined
  }
}
