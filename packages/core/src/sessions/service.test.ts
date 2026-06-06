import { Readable } from 'node:stream'
import type { EngineEvent, EngineKind, Session } from '@multi-wa/types'
import { pino } from 'pino'
import type { Logger } from '../lib/logger'
import { describe, expect, it } from 'vitest'
import type { EngineOptions, EngineRegistry, GroupOperations, WaEngine } from '../engine/types'
import { AppError } from '../lib/errors'
import type { MigrationService } from '../migration/service'
import { SessionManager } from './manager'
import type { SessionRepository } from './repository'
import { SessionService } from './service'

const logger = pino({ level: 'silent' }) as unknown as Logger

class FakeEngine implements WaEngine {
  readonly kind: EngineKind
  readonly groups = {} as GroupOperations
  handler: ((event: EngineEvent) => void) | null = null
  constructor(
    readonly options: EngineOptions,
    kind: EngineKind
  ) {
    this.kind = kind
  }
  onEvent(handler: (event: EngineEvent) => void): void {
    this.handler = handler
  }
  async start(): Promise<void> {
    this.handler?.({ type: 'qr', qr: `qr-${this.options.sessionId}` })
  }
  async stop(): Promise<void> {}
  async logout(): Promise<void> {}
  async send(): Promise<{ id: string }> {
    return { id: 'msg' }
  }
  async downloadMedia(): Promise<Readable> {
    return Readable.from([])
  }
}

class InMemorySessionRepository {
  private readonly rows = new Map<string, Session & { tenantId: string }>()
  private seq = 0

  async create(tenantId: string, name: string, engine: EngineKind): Promise<Session> {
    const id = `id-${++this.seq}`
    const now = new Date().toISOString()
    const row = {
      id,
      tenantId,
      name,
      engine,
      status: 'created' as const,
      meJid: null,
      createdAt: now,
      updatedAt: now
    }
    this.rows.set(id, row)
    return this.strip(row)
  }
  async list(tenantId: string): Promise<Session[]> {
    return [...this.rows.values()].filter((r) => r.tenantId === tenantId).map((r) => this.strip(r))
  }
  async findById(tenantId: string, id: string): Promise<Session | null> {
    const row = this.rows.get(id)
    return row && row.tenantId === tenantId ? this.strip(row) : null
  }
  async listResumable(): Promise<{ session: Session; tenantId: string }[]> {
    return [...this.rows.values()]
      .filter((r) => r.status !== 'logged_out')
      .map((r) => ({ session: this.strip(r), tenantId: r.tenantId }))
  }
  async updateStatus(id: string, status: Session['status'], meJid?: string | null): Promise<void> {
    const row = this.rows.get(id)
    if (!row) return
    row.status = status
    if (meJid !== undefined && meJid !== null) row.meJid = meJid
  }
  async updateEngine(id: string, engine: EngineKind): Promise<void> {
    const row = this.rows.get(id)
    if (row) row.engine = engine
  }
  async delete(tenantId: string, id: string): Promise<boolean> {
    const row = this.rows.get(id)
    if (!row || row.tenantId !== tenantId) return false
    return this.rows.delete(id)
  }
  private strip(row: Session & { tenantId: string }): Session {
    const { tenantId: _tenantId, ...session } = row
    return { ...session }
  }
}

function build() {
  const repository = new InMemorySessionRepository()
  let lastEngine: FakeEngine | undefined
  const registry = {
    baileys: (options: EngineOptions) => (lastEngine = new FakeEngine(options, 'baileys')),
    zapo: (options: EngineOptions) => (lastEngine = new FakeEngine(options, 'zapo'))
  } as unknown as EngineRegistry
  const manager = new SessionManager({
    pool: {} as never,
    tablePrefix: 'wa_',
    logger,
    registry,
    repository: repository as unknown as SessionRepository
  })
  const migrationCalls: { from: EngineKind; to: EngineKind }[] = []
  const migration = {
    migrate: async (_options: EngineOptions, from: EngineKind, to: EngineKind) => {
      migrationCalls.push({ from, to })
      return [{ domain: 'sessions', severity: 'info', count: 0 }]
    }
  } as unknown as MigrationService
  const service = new SessionService({
    repository: repository as unknown as SessionRepository,
    manager,
    migration,
    snapshots: {} as never,
    logger
  })
  return { service, manager, migrationCalls, engine: () => lastEngine }
}

describe('SessionService', () => {
  it('creates and starts a session', async () => {
    const { service, manager } = build()
    const session = await service.create('t1', { name: 'main', engine: 'baileys' })
    expect(session.engine).toBe('baileys')
    expect(manager.isActive(session.id)).toBe(true)
    expect(manager.getLastQr(session.id)).toBe(`qr-${session.id}`)
  })

  it('throws notFound for a missing session', async () => {
    const { service } = build()
    await expect(service.get('t1', 'nope')).rejects.toBeInstanceOf(AppError)
  })

  it('enforces tenant isolation', async () => {
    const { service } = build()
    const session = await service.create('t1', { name: 'main', engine: 'baileys' })
    await expect(service.get('other', session.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('disconnects, logs out and removes', async () => {
    const { service, manager } = build()
    const session = await service.create('t1', { name: 'main', engine: 'baileys' })
    const disconnected = await service.disconnect('t1', session.id)
    expect(disconnected.status).toBe('disconnected')
    await service.remove('t1', session.id)
    expect(manager.isActive(session.id)).toBe(false)
    await expect(service.get('t1', session.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('migrates between engines and restarts', async () => {
    const { service, migrationCalls, manager } = build()
    const session = await service.create('t1', { name: 'main', engine: 'baileys' })
    const result = await service.migrate('t1', session.id, 'zapo')
    expect(result.session.engine).toBe('zapo')
    expect(migrationCalls).toEqual([{ from: 'baileys', to: 'zapo' }])
    expect(manager.isActive(session.id)).toBe(true)
  })

  it('rejects migrating to the same engine', async () => {
    const { service } = build()
    const session = await service.create('t1', { name: 'main', engine: 'baileys' })
    await expect(service.migrate('t1', session.id, 'baileys')).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('resumes all non-logged-out sessions', async () => {
    const { service, manager } = build()
    const a = await service.create('t1', { name: 'a', engine: 'baileys' })
    await manager.stop(a.id)
    await service.resumeAll()
    expect(manager.isActive(a.id)).toBe(true)
  })
})
