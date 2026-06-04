import type { Pool } from '@multi-wa/db'
import type { EngineKind, EngineStatus, Session } from '@multi-wa/types'
import { errors } from '../lib/errors'

const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  )
}

interface SessionRow {
  id: string
  name: string
  engine: EngineKind
  status: EngineStatus
  me_jid: string | null
  created_at: Date
  updated_at: Date
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    engine: row.engine,
    status: row.status,
    meJid: row.me_jid,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

const COLUMNS = 'id, name, engine, status, me_jid, created_at, updated_at'

export class SessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(tenantId: string, name: string, engine: EngineKind): Promise<Session> {
    try {
      const { rows } = await this.pool.query<SessionRow>(
        `INSERT INTO sessions (tenant_id, name, engine, status)
         VALUES ($1, $2, $3, 'created')
         RETURNING ${COLUMNS}`,
        [tenantId, name, engine]
      )
      return toSession(rows[0]!)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw errors.conflict(`a session named "${name}" already exists`)
      }
      throw error
    }
  }

  async list(tenantId: string): Promise<Session[]> {
    const { rows } = await this.pool.query<SessionRow>(
      `SELECT ${COLUMNS} FROM sessions WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    )
    return rows.map(toSession)
  }

  async findById(tenantId: string, id: string): Promise<Session | null> {
    const { rows } = await this.pool.query<SessionRow>(
      `SELECT ${COLUMNS} FROM sessions WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    )
    return rows[0] ? toSession(rows[0]) : null
  }

  async listResumable(): Promise<{ session: Session; tenantId: string }[]> {
    const { rows } = await this.pool.query<SessionRow & { tenant_id: string }>(
      `SELECT ${COLUMNS}, tenant_id FROM sessions WHERE status <> 'logged_out'`
    )
    return rows.map((row) => ({ session: toSession(row), tenantId: row.tenant_id }))
  }

  async updateStatus(id: string, status: EngineStatus, meJid?: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE sessions
       SET status = $2,
           me_jid = COALESCE($3, me_jid),
           updated_at = now()
       WHERE id = $1`,
      [id, status, meJid ?? null]
    )
  }

  async updateEngine(id: string, engine: EngineKind): Promise<void> {
    await this.pool.query(`UPDATE sessions SET engine = $2, updated_at = now() WHERE id = $1`, [
      id,
      engine
    ])
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM sessions WHERE tenant_id = $1 AND id = $2`, [
      tenantId,
      id
    ])
    return (result.rowCount ?? 0) > 0
  }
}
