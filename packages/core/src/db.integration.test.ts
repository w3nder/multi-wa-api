import pg from 'pg'
import { runMigrations } from '../../db/src/migrate'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiKeyRepository, RefreshTokenRepository, UserRepository } from './auth/repository'
import { AuthService } from './auth/service'
import { SessionRepository } from './sessions/repository'
import { WebhookRepository } from './webhooks/repository'

const url = process.env.TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('database integration', () => {
  let pool: pg.Pool

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url })
    await runMigrations(pool)
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('persists sessions with tenant isolation and updates', async () => {
    const users = new UserRepository(pool)
    const owner = await users.createTenantWithUser('t', `s-${Date.now()}@x.com`, 'hash')
    const repo = new SessionRepository(pool)

    const created = await repo.create(owner.tenantId, `sess-${Date.now()}`, 'baileys')
    expect(await repo.findById(owner.tenantId, created.id)).toMatchObject({ id: created.id })
    expect(await repo.findById('00000000-0000-0000-0000-000000000000', created.id)).toBeNull()

    await repo.updateStatus(created.id, 'connected', 'me@s.whatsapp.net')
    await repo.updateEngine(created.id, 'zapo')
    const updated = await repo.findById(owner.tenantId, created.id)
    expect(updated?.status).toBe('connected')
    expect(updated?.engine).toBe('zapo')
    expect(updated?.meJid).toBe('me@s.whatsapp.net')

    expect(await repo.delete(owner.tenantId, created.id)).toBe(true)
    expect(await repo.findById(owner.tenantId, created.id)).toBeNull()
  })

  it('runs the auth flow against real repositories', async () => {
    const auth = new AuthService(
      new UserRepository(pool),
      new ApiKeyRepository(pool),
      new RefreshTokenRepository(pool),
      3600
    )
    const email = `a-${Date.now()}@x.com`
    await auth.ensureBootstrapUser('t', email, 'password123')
    const principal = await auth.verifyCredentials(email, 'password123')

    const apiKey = await auth.createApiKey(principal.tenantId, 'ci')
    expect((await auth.authenticateApiKey(apiKey.key))?.tenantId).toBe(principal.tenantId)

    const refresh = await auth.issueRefreshToken(principal.userId)
    const rotation = await auth.rotateRefreshToken(refresh)
    expect(rotation.tenantId).toBe(principal.tenantId)
    await expect(auth.rotateRefreshToken(refresh)).rejects.toBeTruthy()
  })

  it('lists only active webhook targets per tenant', async () => {
    const users = new UserRepository(pool)
    const owner = await users.createTenantWithUser('t', `w-${Date.now()}@x.com`, 'hash')
    const repo = new WebhookRepository(pool)
    await repo.create(
      owner.tenantId,
      { url: 'https://x/h', events: ['message'] },
      'secret-secret-1'
    )
    const targets = await repo.listActiveTargets(owner.tenantId)
    expect(targets).toHaveLength(1)
    expect(targets[0]!.events).toContain('message')
  })
})
