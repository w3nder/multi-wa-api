import { loadConfig } from '@multi-wa/config'
import pg from 'pg'

const { Pool } = pg
export type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (pool) return pool
  const env = loadConfig()
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.PG_POOL_MAX,
    idleTimeoutMillis: 30000
  })
  return pool
}

export async function closePool(): Promise<void> {
  if (!pool) return
  await pool.end()
  pool = null
}
