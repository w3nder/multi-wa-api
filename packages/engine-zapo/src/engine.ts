import { errors, type EngineOptions, type WaEngine } from '@multi-wa/core'
import type { EngineEvent, MessageContent, SendMessageResult } from '@multi-wa/types'
import { WaClient } from 'zapo-js'
import type { PgCleanupPoller } from '@zapo-js/store-postgres'
import { buildZapoStore, type ZapoStoreBundle } from './store'
import { mapZapoChatstate, mapZapoMessageEvent, mapZapoPresence, mapZapoReceipt } from './events'
import { createZapoGroups } from './groups'
import { toZapoLogger } from './logger'
import { toZapoContent } from './translate'

const RECONNECT_DELAY_MS = 2000

export class ZapoEngine implements WaEngine {
  readonly kind = 'zapo' as const
  readonly groups = createZapoGroups(() => this.requireClient().group)
  private client: WaClient | null = null
  private bundle: ZapoStoreBundle | null = null
  private poller: PgCleanupPoller | null = null
  private handler: ((event: EngineEvent) => void) | null = null
  private stopping = false

  constructor(private readonly options: EngineOptions) {}

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

  private ensureBundle(): ZapoStoreBundle {
    if (!this.bundle) {
      this.bundle = buildZapoStore(this.options.pool, this.options.tablePrefix)
      this.poller = this.bundle.result.startCleanup(this.options.sessionId)
    }
    return this.bundle
  }

  private async destroyBundle(): Promise<void> {
    this.poller?.stop()
    this.poller = null
    const bundle = this.bundle
    this.bundle = null
    await bundle?.result.destroy().catch(() => undefined)
  }

  private async connect(): Promise<void> {
    const { store } = this.ensureBundle()
    const client = new WaClient(
      { store, sessionId: this.options.sessionId, history: { enabled: false } },
      toZapoLogger(this.options.logger)
    )
    this.client = client

    client.on('auth_qr', ({ qr }) => {
      this.options.logger.info('qr code generated, awaiting scan')
      this.emit({ type: 'qr', qr })
    })

    client.on('auth_paired', ({ credentials }) => {
      this.options.logger.info({ meJid: credentials.meJid }, 'paired')
      this.emit({ type: 'connection', status: 'connected', meJid: credentials.meJid })
    })

    client.on('connection', (event) => {
      void this.handleConnection(event)
    })

    client.on('message', (event) => {
      this.emit(mapZapoMessageEvent(event))
    })

    client.on('receipt', (event) => {
      const ack = mapZapoReceipt(event)
      if (ack) this.emit(ack)
    })

    client.on('presence', (event) => {
      this.emit(mapZapoPresence(event))
    })

    client.on('chatstate', (event) => {
      this.emit(mapZapoChatstate(event))
    })

    await client.connect()
  }

  private async handleConnection(event: { status: string; isLogout?: boolean }): Promise<void> {
    if (event.status === 'open') {
      const credentials = await this.ensureBundle()
        .store.session(this.options.sessionId)
        .auth.load()
      this.options.logger.info({ meJid: credentials?.meJid }, 'connected')
      this.emit({ type: 'connection', status: 'connected', meJid: credentials?.meJid })
      return
    }

    if (event.status === 'close') {
      this.client = null
      if (event.isLogout) {
        await this.destroyBundle()
        this.options.logger.warn('logged out')
        this.emit({ type: 'connection', status: 'logged_out' })
        return
      }
      if (!this.stopping) {
        this.options.logger.warn('connection closed, reconnecting')
        this.emit({ type: 'connection', status: 'disconnected' })
        setTimeout(() => {
          if (!this.stopping) void this.connect()
        }, RECONNECT_DELAY_MS)
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    await this.client?.disconnect().catch(() => undefined)
    this.client = null
    await this.destroyBundle()
  }

  async logout(): Promise<void> {
    this.stopping = true
    try {
      await this.client?.logout()
    } finally {
      this.client = null
      await this.destroyBundle()
    }
  }

  private requireClient(): WaClient {
    if (!this.client) throw errors.conflict('session is not connected')
    return this.client
  }

  async send(to: string, content: MessageContent): Promise<SendMessageResult> {
    const result = await this.requireClient().message.send(to, await toZapoContent(content))
    return { id: result.id }
  }
}

export function createZapoEngine(options: EngineOptions): WaEngine {
  return new ZapoEngine(options)
}
