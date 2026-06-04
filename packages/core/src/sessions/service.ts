import type { CreateSessionInput, EngineKind, Session } from '@multi-wa/types'
import type { SnapshotRegistry } from '../engine/types'
import { errors } from '../lib/errors'
import type { Logger } from '../lib/logger'
import type { MigrationLoss, MigrationService } from '../migration/service'
import type { SessionManager } from './manager'
import type { SessionRepository } from './repository'

export interface SessionServiceDeps {
  repository: SessionRepository
  manager: SessionManager
  migration: MigrationService
  snapshots: SnapshotRegistry
  logger: Logger
}

export interface MigrationResult {
  session: Session
  losses: MigrationLoss[]
}

export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  async create(tenantId: string, input: CreateSessionInput): Promise<Session> {
    const session = await this.deps.repository.create(tenantId, input.name, input.engine)
    await this.deps.manager.start(session, tenantId)
    return (await this.deps.repository.findById(tenantId, session.id)) ?? session
  }

  async list(tenantId: string): Promise<Session[]> {
    return this.deps.repository.list(tenantId)
  }

  async get(tenantId: string, id: string): Promise<Session> {
    const session = await this.deps.repository.findById(tenantId, id)
    if (!session) throw errors.notFound('session not found')
    return session
  }

  async connect(tenantId: string, id: string): Promise<Session> {
    const session = await this.get(tenantId, id)
    if (!this.deps.manager.isActive(id)) {
      await this.deps.manager.start(session, tenantId)
    }
    return this.get(tenantId, id)
  }

  async disconnect(tenantId: string, id: string): Promise<Session> {
    await this.get(tenantId, id)
    await this.deps.manager.stop(id)
    await this.deps.repository.updateStatus(id, 'disconnected')
    return this.get(tenantId, id)
  }

  async logout(tenantId: string, id: string): Promise<Session> {
    await this.get(tenantId, id)
    await this.deps.manager.logout(id)
    await this.deps.repository.updateStatus(id, 'logged_out', null)
    return this.get(tenantId, id)
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.get(tenantId, id)
    await this.deps.manager.stop(id)
    await this.deps.repository.delete(tenantId, id)
  }

  async getQr(tenantId: string, id: string): Promise<string | null> {
    await this.get(tenantId, id)
    return this.deps.manager.getLastQr(id)
  }

  async migrate(tenantId: string, id: string, to: EngineKind): Promise<MigrationResult> {
    const session = await this.get(tenantId, id)
    if (session.engine === to) {
      throw errors.badRequest(`session already uses the ${to} engine`)
    }
    await this.deps.manager.stop(id)
    const options = this.deps.manager.buildOptions(id)
    const losses = await this.deps.migration.migrate(options, session.engine, to)
    await this.deps.repository.updateEngine(id, to)
    const migrated = await this.get(tenantId, id)
    await this.deps.manager.start(migrated, tenantId)
    return { session: await this.get(tenantId, id), losses }
  }

  async resumeAll(): Promise<void> {
    const resumable = await this.deps.repository.listResumable()
    for (const { session, tenantId } of resumable) {
      this.deps.manager.start(session, tenantId).catch((error) => {
        this.deps.logger.warn({ err: error, session: session.id }, 'failed to resume session')
      })
    }
  }
}
