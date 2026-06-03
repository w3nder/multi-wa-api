import type { Pool } from '@multi-wa/db'
import type { EngineOptions, EngineSnapshotAdapter } from '@multi-wa/core'
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap
} from 'baileys'

const CREDS_CATEGORY = 'creds'
const CREDS_ID = 'creds'

function serialize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer))
}

function revive(value: unknown): any {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver)
}

async function loadCreds(pool: Pool, sessionId: string): Promise<AuthenticationCreds | null> {
  const { rows } = await pool.query<{ value: unknown }>(
    `SELECT value FROM baileys_auth WHERE session_id = $1 AND category = $2 AND item_id = $3`,
    [sessionId, CREDS_CATEGORY, CREDS_ID]
  )
  return rows[0] ? (revive(rows[0].value) as AuthenticationCreds) : null
}

async function upsert(
  pool: Pool,
  sessionId: string,
  category: string,
  itemId: string,
  value: unknown
): Promise<void> {
  await pool.query(
    `INSERT INTO baileys_auth (session_id, category, item_id, value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id, category, item_id) DO UPDATE SET value = EXCLUDED.value`,
    [sessionId, category, itemId, serialize(value)]
  )
}

async function remove(
  pool: Pool,
  sessionId: string,
  category: string,
  itemId: string
): Promise<void> {
  await pool.query(
    `DELETE FROM baileys_auth WHERE session_id = $1 AND category = $2 AND item_id = $3`,
    [sessionId, category, itemId]
  )
}

export interface PostgresAuthState {
  state: AuthenticationState
  saveCreds: () => Promise<void>
}

export async function usePostgresAuthState(
  pool: Pool,
  sessionId: string
): Promise<PostgresAuthState> {
  const creds = (await loadCreds(pool, sessionId)) ?? initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        async get(type, ids) {
          const { rows } = await pool.query<{ item_id: string; value: unknown }>(
            `SELECT item_id, value FROM baileys_auth
             WHERE session_id = $1 AND category = $2 AND item_id = ANY($3::text[])`,
            [sessionId, type, ids]
          )
          const result: { [id: string]: SignalDataTypeMap[typeof type] } = {}
          for (const row of rows) {
            let value = revive(row.value)
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value)
            }
            result[row.item_id] = value
          }
          return result
        },
        async set(data) {
          const tasks: Promise<void>[] = []
          for (const category of Object.keys(data)) {
            const entries = data[category as keyof typeof data]
            if (!entries) continue
            for (const id of Object.keys(entries)) {
              const value = entries[id]
              tasks.push(
                value
                  ? upsert(pool, sessionId, category, id, value)
                  : remove(pool, sessionId, category, id)
              )
            }
          }
          await Promise.all(tasks)
        }
      }
    },
    async saveCreds() {
      await upsert(pool, sessionId, CREDS_CATEGORY, CREDS_ID, creds)
    }
  }
}

export interface BaileysSnapshot {
  creds: AuthenticationCreds
  keys: Record<string, Record<string, unknown>>
}

export async function readBaileysSnapshot(
  pool: Pool,
  sessionId: string
): Promise<BaileysSnapshot> {
  const creds = await loadCreds(pool, sessionId)
  if (!creds) throw new Error('no baileys credentials to migrate')
  const { rows } = await pool.query<{ category: string; item_id: string; value: unknown }>(
    `SELECT category, item_id, value FROM baileys_auth WHERE session_id = $1 AND category <> $2`,
    [sessionId, CREDS_CATEGORY]
  )
  const keys: Record<string, Record<string, unknown>> = {}
  for (const row of rows) {
    ;(keys[row.category] ??= {})[row.item_id] = revive(row.value)
  }
  return { creds, keys }
}

export async function writeBaileysSnapshot(
  pool: Pool,
  sessionId: string,
  data: BaileysSnapshot
): Promise<void> {
  await clearBaileys(pool, sessionId)
  await upsert(pool, sessionId, CREDS_CATEGORY, CREDS_ID, data.creds)
  const tasks: Promise<void>[] = []
  for (const category of Object.keys(data.keys)) {
    const entries = data.keys[category] ?? {}
    for (const id of Object.keys(entries)) {
      tasks.push(upsert(pool, sessionId, category, id, entries[id]))
    }
  }
  await Promise.all(tasks)
}

export async function clearBaileys(pool: Pool, sessionId: string): Promise<void> {
  await pool.query(`DELETE FROM baileys_auth WHERE session_id = $1`, [sessionId])
}

export const baileysSnapshotAdapter: EngineSnapshotAdapter = {
  read: (options: EngineOptions) => readBaileysSnapshot(options.pool, options.sessionId),
  write: (options: EngineOptions, data: unknown) =>
    writeBaileysSnapshot(options.pool, options.sessionId, data as BaileysSnapshot),
  clear: (options: EngineOptions) => clearBaileys(options.pool, options.sessionId)
}
