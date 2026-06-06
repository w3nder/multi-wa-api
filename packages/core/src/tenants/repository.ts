import type { Pool } from '@multi-wa/db'
import type { MediaStorageMode } from '@multi-wa/types'

interface CachedMode {
  mode: MediaStorageMode
  expiresAt: number
}

export class TenantRepository {
  private readonly cache = new Map<string, CachedMode>()
  private readonly cacheTtlMs: number

  constructor(
    private readonly pool: Pool,
    cacheTtlMs = 5000
  ) {
    this.cacheTtlMs = cacheTtlMs
  }

  async getMediaStorage(tenantId: string): Promise<MediaStorageMode> {
    const cached = this.cache.get(tenantId)
    if (cached && cached.expiresAt > nowMs()) return cached.mode
    const { rows } = await this.pool.query<{ media_storage: MediaStorageMode }>(
      `SELECT media_storage FROM tenants WHERE id = $1`,
      [tenantId]
    )
    const mode = rows[0]?.media_storage ?? 'default'
    this.cache.set(tenantId, { mode, expiresAt: nowMs() + this.cacheTtlMs })
    return mode
  }

  async setMediaStorage(tenantId: string, mode: MediaStorageMode): Promise<MediaStorageMode> {
    const { rows } = await this.pool.query<{ media_storage: MediaStorageMode }>(
      `UPDATE tenants SET media_storage = $2 WHERE id = $1 RETURNING media_storage`,
      [tenantId, mode]
    )
    const updated = rows[0]?.media_storage ?? mode
    this.cache.set(tenantId, { mode: updated, expiresAt: nowMs() + this.cacheTtlMs })
    return updated
  }
}

function nowMs(): number {
  return Number(process.hrtime.bigint() / 1_000_000n)
}
