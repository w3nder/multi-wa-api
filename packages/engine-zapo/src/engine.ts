import type { EngineOptions, WaEngine } from '@multi-wa/core'
import type { EngineEvent, MessageContent, SendMessageResult } from '@multi-wa/types'
import { WaClient } from 'zapo-js'
import type { PgCleanupPoller } from '@zapo-js/store-postgres'
import { buildZapoStore } from './store'
import { toZapoContent } from './translate'

const RECONNECT_DELAY_MS = 2000

export class ZapoEngine implements WaEngine {
  readonly kind = 'zapo' as const
  private client: WaClient | null = null
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
    await this.connect()
  }

  private teardown(): void {
    this.poller?.stop()
    this.poller = null
    this.client = null
  }

  private async connect(): Promise<void> {
    const { result, store } = buildZapoStore(this.options.pool, this.options.tablePrefix)
    const client = new WaClient(
      { store, sessionId: this.options.sessionId, history: { enabled: false } },
      this.options.logger as never
    )
    this.client = client

    client.on('auth_qr', ({ qr }) => {
      this.emit({ type: 'qr', qr })
    })

    client.on('auth_paired', ({ credentials }) => {
      this.emit({ type: 'status', status: 'connected', meJid: credentials.meJid })
    })

    client.on('connection', (event) => {
      void this.handleConnection(event, store)
    })

    client.on('message', (event) => {
      const chat = event.key.remoteJid
      this.emit({
        type: 'message',
        id: event.key.id,
        chat,
        from: event.key.participant ?? chat,
        fromMe: event.key.fromMe,
        text: extractText(event.message),
        timestamp: event.timestampSeconds
      })
    })

    this.poller = result.startCleanup(this.options.sessionId)
    await client.connect()
  }

  private async handleConnection(
    event: { status: string; isLogout?: boolean },
    store: ReturnType<typeof buildZapoStore>['store']
  ): Promise<void> {
    if (event.status === 'open') {
      const credentials = await store.session(this.options.sessionId).auth.load()
      this.emit({ type: 'status', status: 'connected', meJid: credentials?.meJid })
      return
    }

    if (event.status === 'close') {
      this.teardown()
      if (event.isLogout) {
        this.emit({ type: 'status', status: 'logged_out' })
        return
      }
      if (!this.stopping) {
        this.emit({ type: 'status', status: 'disconnected' })
        setTimeout(() => {
          if (!this.stopping) void this.connect()
        }, RECONNECT_DELAY_MS)
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    await this.client?.disconnect().catch(() => undefined)
    this.teardown()
  }

  async logout(): Promise<void> {
    this.stopping = true
    try {
      await this.client?.logout()
    } finally {
      this.teardown()
    }
  }

  async send(to: string, content: MessageContent): Promise<SendMessageResult> {
    if (!this.client) throw new Error('zapo client is not connected')
    const result = await this.client.message.send(to, await toZapoContent(content))
    return { id: result.id }
  }
}

function extractText(message: { conversation?: string | null; extendedTextMessage?: { text?: string | null } | null } | null | undefined): string | undefined {
  if (!message) return undefined
  return message.conversation ?? message.extendedTextMessage?.text ?? undefined
}

export function createZapoEngine(options: EngineOptions): WaEngine {
  return new ZapoEngine(options)
}
