import type { Readable } from 'node:stream'
import { errors, type EngineOptions, type WaEngine } from '@multi-wa/core'
import type { EngineEvent, MediaRef, MessageContent, SendMessageResult } from '@multi-wa/types'
import makeWASocket, {
  DisconnectReason,
  downloadContentFromMessage,
  jidNormalizedUser,
  type WASocket
} from 'baileys'
import { clearBaileys, usePostgresAuthState } from './auth-state'
import {
  isBaileysReactionUpsert,
  mapBaileysAck,
  mapBaileysCall,
  mapBaileysGroupParticipants,
  mapBaileysGroupUpdate,
  mapBaileysMembershipRequest,
  mapBaileysMessageEvent,
  mapBaileysPresence,
  mapBaileysReaction,
  mapBaileysReceipt
} from './events'
import { createBaileysGroups } from './groups'
import { toBaileysLogger } from './logger'
import { toBaileysContent } from './translate'

const RECONNECT_DELAY_MS = 2000

export class BaileysEngine implements WaEngine {
  readonly kind = 'baileys' as const
  readonly groups = createBaileysGroups(() => this.requireSocket())
  private sock: WASocket | null = null
  private handler: ((event: EngineEvent) => void) | null = null
  private stopping = false

  constructor(private readonly options: EngineOptions) {}

  private requireSocket(): WASocket {
    if (!this.sock) throw errors.conflict('session is not connected')
    return this.sock
  }

  onEvent(handler: (event: EngineEvent) => void): void {
    this.handler = handler
  }

  private emit(event: EngineEvent): void {
    this.handler?.(event)
  }

  async start(): Promise<void> {
    this.stopping = false
    this.options.logger.info('starting engine')
    await this.connect()
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await usePostgresAuthState(
      this.options.pool,
      this.options.sessionId
    )

    const sock = makeWASocket({
      auth: state,
      logger: toBaileysLogger(this.options.logger),
      browser: ['Multi-WA API', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false
    })
    this.sock = sock

    sock.ev.on('creds.update', () => {
      void saveCreds()
    })

    sock.ev.on('connection.update', (update) => {
      void this.handleConnectionUpdate(update)
    })

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return
      for (const message of messages) {
        if (!message.key.remoteJid) continue
        // reactions arrive via the dedicated 'messages.reaction' event
        if (isBaileysReactionUpsert(message)) continue
        this.emit(mapBaileysMessageEvent(message))
      }
    })

    sock.ev.on('messages.reaction', (reactions) => {
      for (const entry of reactions) {
        if (!entry.reaction.key?.remoteJid) continue
        this.emit(mapBaileysReaction(entry))
      }
    })

    sock.ev.on('messages.update', (updates) => {
      for (const update of updates) {
        const ack = mapBaileysAck(update)
        if (ack) this.emit(ack)
      }
    })

    sock.ev.on('message-receipt.update', (updates) => {
      for (const update of updates) {
        const ack = mapBaileysReceipt(update)
        if (ack) this.emit(ack)
      }
    })

    sock.ev.on('presence.update', (update) => {
      for (const event of mapBaileysPresence(update)) {
        this.emit(event)
      }
    })

    sock.ev.on('call', (calls) => {
      for (const call of calls) {
        const event = mapBaileysCall(call)
        if (event) this.emit(event)
      }
    })

    sock.ev.on('group-participants.update', (update) => {
      const event = mapBaileysGroupParticipants(update)
      if (event) this.emit(event)
    })

    sock.ev.on('groups.update', (updates) => {
      for (const update of updates) {
        const event = mapBaileysGroupUpdate(update)
        if (event) this.emit(event)
      }
    })

    sock.ev.on('group.join-request', (update) => {
      const event = mapBaileysMembershipRequest(update)
      if (event) this.emit(event)
    })
  }

  private async handleConnectionUpdate(
    update: Partial<{
      connection: string
      qr: string
      lastDisconnect: { error?: unknown }
    }>
  ): Promise<void> {
    if (update.qr) {
      this.options.logger.info('qr code generated, awaiting scan')
      this.emit({ type: 'qr', qr: update.qr })
    }

    if (update.connection === 'connecting') {
      this.emit({ type: 'connection', status: 'connecting' })
    }

    if (update.connection === 'open') {
      const meJid = this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : undefined
      this.options.logger.info({ meJid, name: this.sock?.user?.name }, 'connected')
      this.emit({ type: 'connection', status: 'connected', meJid })
    }

    if (update.connection === 'close') {
      const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } })
        ?.output?.statusCode

      if (statusCode === DisconnectReason.loggedOut) {
        await clearBaileys(this.options.pool, this.options.sessionId)
        this.options.logger.warn('logged out, credentials cleared')
        this.emit({ type: 'connection', status: 'logged_out' })
        return
      }

      if (!this.stopping) {
        this.options.logger.warn({ statusCode }, 'connection closed, reconnecting')
        this.emit({ type: 'connection', status: 'disconnected' })
        setTimeout(() => {
          if (!this.stopping) void this.connect()
        }, RECONNECT_DELAY_MS)
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    this.sock?.end(undefined)
    this.sock = null
  }

  async logout(): Promise<void> {
    this.stopping = true
    try {
      await this.sock?.logout()
    } finally {
      this.sock?.end(undefined)
      this.sock = null
      await clearBaileys(this.options.pool, this.options.sessionId)
    }
  }

  async send(to: string, content: MessageContent): Promise<SendMessageResult> {
    const result = await this.requireSocket().sendMessage(to, toBaileysContent(content))
    return { id: result?.key.id ?? undefined }
  }

  async downloadMedia(ref: MediaRef): Promise<Readable> {
    const { mediaKey, directPath, url } = ref.media
    if (!mediaKey || !directPath) {
      throw errors.badRequest('media reference is missing mediaKey or directPath')
    }
    return downloadContentFromMessage(
      { mediaKey: Buffer.from(mediaKey, 'base64'), directPath, url: url ?? undefined },
      ref.type
    )
  }
}

export function createBaileysEngine(options: EngineOptions): WaEngine {
  return new BaileysEngine(options)
}
