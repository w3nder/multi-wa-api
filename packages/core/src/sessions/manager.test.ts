import type { EngineEvent, Session } from '@multi-wa/types'
import { pino } from 'pino'
import type { Logger } from '../lib/logger'
import { describe, expect, it, vi } from 'vitest'
import type { EngineOptions, EngineRegistry, GroupOperations, WaEngine } from '../engine/types'
import type { SessionRepository } from './repository'
import { SessionManager } from './manager'

const logger = pino({ level: 'silent' }) as unknown as Logger

class FakeEngine implements WaEngine {
  readonly kind = 'baileys' as const
  readonly groups = {} as GroupOperations
  handler: ((event: EngineEvent) => void) | null = null
  started = false
  stopped = false
  loggedOut = false
  constructor(readonly options: EngineOptions) {}
  onEvent(handler: (event: EngineEvent) => void): void {
    this.handler = handler
  }
  async start(): Promise<void> {
    this.started = true
  }
  async stop(): Promise<void> {
    this.stopped = true
  }
  async logout(): Promise<void> {
    this.loggedOut = true
  }
  async send(): Promise<{ id: string }> {
    return { id: 'msg' }
  }
  emit(event: EngineEvent): void {
    this.handler?.(event)
  }
}

const session: Session = {
  id: 's1',
  name: 'a',
  engine: 'baileys',
  status: 'created',
  meJid: null,
  createdAt: '',
  updatedAt: ''
}

function fakeRepo() {
  const statuses: { status: string; meJid: string | null }[] = []
  const repo = {
    updateStatus: vi.fn(async (_id: string, status: string, meJid?: string | null) => {
      statuses.push({ status, meJid: meJid ?? null })
    })
  }
  return { repo: repo as unknown as SessionRepository, statuses }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 10))

describe('SessionManager', () => {
  it('starts an engine, tracks qr, fans out events and notifies webhooks', async () => {
    let engine: FakeEngine | undefined
    const registry = {
      baileys: (options: EngineOptions) => {
        engine = new FakeEngine(options)
        return engine
      },
      zapo: (options: EngineOptions) => new FakeEngine(options)
    } as unknown as EngineRegistry
    const { repo, statuses } = fakeRepo()
    const webhookEvents: { tenantId: string; sessionId: string; event: EngineEvent }[] = []

    const manager = new SessionManager({
      pool: {} as never,
      tablePrefix: 'wa_',
      logger,
      registry,
      repository: repo,
      onEvent: (tenantId, sessionId, event) => webhookEvents.push({ tenantId, sessionId, event })
    })

    await manager.start(session, 'tenant1')
    expect(manager.isActive('s1')).toBe(true)
    expect(engine?.started).toBe(true)

    const received: EngineEvent[] = []
    manager.subscribe('s1', (event) => received.push(event))

    engine!.emit({ type: 'qr', qr: 'QR1' })
    expect(manager.getLastQr('s1')).toBe('QR1')

    engine!.emit({ type: 'connection', status: 'connected', meJid: 'me@s.whatsapp.net' })
    expect(manager.getLastQr('s1')).toBeNull()

    engine!.emit({
      type: 'message',
      chat: 'c@s',
      from: 'c@s',
      fromMe: false,
      isGroup: false,
      content: { type: 'text', text: 'hi' }
    })
    await flush()

    expect(received.map((event) => event.type).sort()).toEqual(['connection', 'message', 'qr'])
    expect(webhookEvents).toHaveLength(3)
    expect(statuses.some((entry) => entry.status === 'qr')).toBe(true)
    expect(statuses.some((entry) => entry.status === 'connected')).toBe(true)
  })

  it('is idempotent on start and stops/logs out engines', async () => {
    let engine: FakeEngine | undefined
    const registry = {
      baileys: (options: EngineOptions) => {
        engine = new FakeEngine(options)
        return engine
      },
      zapo: (options: EngineOptions) => new FakeEngine(options)
    } as unknown as EngineRegistry
    const { repo } = fakeRepo()
    const manager = new SessionManager({
      pool: {} as never,
      tablePrefix: 'wa_',
      logger,
      registry,
      repository: repo
    })

    await manager.start(session, 'tenant1')
    const first = engine
    await manager.start(session, 'tenant1')
    expect(engine).toBe(first)

    await manager.logout('s1')
    expect(first?.loggedOut).toBe(true)
    expect(manager.isActive('s1')).toBe(false)
  })

  it('returns a no-op unsubscribe for inactive sessions', () => {
    const { repo } = fakeRepo()
    const manager = new SessionManager({
      pool: {} as never,
      tablePrefix: 'wa_',
      logger,
      registry: {} as unknown as EngineRegistry,
      repository: repo
    })
    expect(() => manager.subscribe('missing', () => undefined)()).not.toThrow()
  })
})
