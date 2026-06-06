import type { Pool } from '@multi-wa/db'
import { describe, expect, it } from 'vitest'
import { TenantRepository } from './repository'

describe('TenantRepository', () => {
  it('reads media storage and caches the result', async () => {
    let queries = 0
    const pool = {
      query: async () => {
        queries += 1
        return { rows: [{ media_storage: 's3' }] }
      }
    } as unknown as Pool
    const repo = new TenantRepository(pool, 10000)

    expect(await repo.getMediaStorage('t1')).toBe('s3')
    expect(await repo.getMediaStorage('t1')).toBe('s3')
    expect(queries).toBe(1)
  })

  it('defaults to "default" when the tenant row is missing', async () => {
    const pool = { query: async () => ({ rows: [] }) } as unknown as Pool
    const repo = new TenantRepository(pool, 10000)
    expect(await repo.getMediaStorage('missing')).toBe('default')
  })

  it('updates media storage and refreshes the cache', async () => {
    let queries = 0
    const pool = {
      query: async (sql: string) => {
        queries += 1
        return { rows: [{ media_storage: sql.includes('UPDATE') ? 'none' : 's3' }] }
      }
    } as unknown as Pool
    const repo = new TenantRepository(pool, 10000)

    expect(await repo.setMediaStorage('t1', 'none')).toBe('none')
    expect(await repo.getMediaStorage('t1')).toBe('none')
    expect(queries).toBe(1)
  })
})
