import { errors, type EngineOptions, type WaEngine } from '@multi-wa/core'
import type { EngineEvent, MessageContent, SendMessageResult } from '@multi-wa/types'
import makeWASocket, {
  DisconnectReason,
  getContentType,
  jidNormalizedUser,
  type WAMessage,
  type WASocket
} from 'baileys'
import { clearBaileys, usePostgresAuthState } from './auth-state'
import { createBaileysGroups } from './groups'
import { toBaileysLogger } from './logger'
import { toBaileysContent } from './translate'

const RECONNECT_DELAY_MS = 2000

function extractText(message: WAMessage): string | undefined {
  const content = message.message
  if (!content) return undefined
  const type = getContentType(content)
  if (type === 'conversation') return content.conversation ?? undefined
  if (type === 'extendedTextMessage') return content.extendedTextMessage?.text ?? undefined
  return (
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    undefined
  )
}

export class BaileysEngine implements WaEngine {
  readonly kind = 'baileys' as const
  readonly groups = createBaileysGroups(() => this.requireSocket())
  private sock: WASocket | null = null
  private ready = false
  private handler: ((event: EngineEvent) => void) | null = null
  private stopping = false

  constructor(private readonly options: EngineOptions) {}

  private requireSocket(): WASocket {
    if (!this.sock || !this.ready) throw errors.conflict('session is not connected')
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
        const chat = message.key.remoteJid
        if (!chat) continue
        this.emit({
          type: 'message',
          id: message.key.id ?? undefined,
          chat,
          from: message.key.participant ?? chat,
          fromMe: Boolean(message.key.fromMe),
          text: extractText(message),
          timestamp:
            typeof message.messageTimestamp === 'number'
              ? message.messageTimestamp
              : Number(message.messageTimestamp ?? 0)
        })
      }
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
      this.emit({ type: 'status', status: 'connecting' })
    }

    if (update.connection === 'open') {
      this.ready = true
      const meJid = this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : undefined
      this.options.logger.info({ meJid, name: this.sock?.user?.name }, 'connected')
      this.emit({ type: 'status', status: 'connected', meJid })
    }

    if (update.connection === 'close') {
      this.ready = false
      const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } })
        ?.output?.statusCode

      if (statusCode === DisconnectReason.loggedOut) {
        await clearBaileys(this.options.pool, this.options.sessionId)
        this.options.logger.warn('logged out, credentials cleared')
        this.emit({ type: 'status', status: 'logged_out' })
        return
      }

      if (!this.stopping) {
        this.options.logger.warn({ statusCode }, 'connection closed, reconnecting')
        this.emit({ type: 'status', status: 'disconnected' })
        setTimeout(() => {
          if (!this.stopping) void this.connect()
        }, RECONNECT_DELAY_MS)
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    this.ready = false
    this.sock?.end(undefined)
    this.sock = null
  }

  async logout(): Promise<void> {
    this.stopping = true
    this.ready = false
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
}

export function createBaileysEngine(options: EngineOptions): WaEngine {
  return new BaileysEngine(options)
}
