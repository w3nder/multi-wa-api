import { AppError } from '@multi-wa/core'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Container } from '../container'
import { buildApp } from './server'

const principal = { userId: 'u1', tenantId: 't1' }

const session = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'main',
  engine: 'baileys' as const,
  status: 'created' as const,
  meJid: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const group = {
  id: '120363047212563241@g.us',
  subject: 'Test group',
  owner: null,
  description: null,
  createdAt: null,
  announce: false,
  restrict: false,
  size: 1,
  participants: [{ id: '5511@s.whatsapp.net', admin: 'superadmin' as const }]
}

function fakeContainer(): Container {
  return {
    config: {
      NODE_ENV: 'test',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgres://localhost/none',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      JWT_ACCESS_TTL: 900,
      JWT_REFRESH_TTL: 3600,
      CORS_ORIGINS: '*',
      RATE_LIMIT_MAX: 1000,
      RATE_LIMIT_WINDOW: '1 minute',
      BODY_LIMIT: 1048576,
      WA_TABLE_PREFIX: 'wa_',
      WEBHOOK_TIMEOUT_MS: 1000,
      WEBHOOK_MAX_RETRIES: 0,
      BOOTSTRAP_TENANT_NAME: 'default'
    },
    logger: { level: 'silent' } as never,
    pool: { query: async () => ({ rows: [{ '?column?': 1 }] }) } as never,
    authService: {
      authenticateApiKey: async (key: string) => (key === 'valid.key' ? principal : null),
      verifyCredentials: async () => principal,
      issueRefreshToken: async () => 'refresh-token'
    } as never,
    sessionService: {
      create: async () => session,
      get: async (_tenant: string, id: string) => {
        if (id !== session.id) throw new AppError(404, 'not_found', 'session not found')
        return session
      },
      list: async () => [session]
    } as never,
    messagingService: {} as never,
    groupService: {
      create: async () => group,
      metadata: async () => group,
      updateParticipants: async () => [{ id: '5511@s.whatsapp.net', status: 200 }]
    } as never,
    webhookService: {} as never,
    manager: {} as never
  }
}

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp(fakeContainer())
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('api routes', () => {
  it('serves health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('rejects unauthenticated session listing', async () => {
    const res = await app.inject({ method: 'GET', url: '/sessions' })
    expect(res.statusCode).toBe(401)
  })

  it('issues tokens on login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'a@b.com', password: 'secret' }
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBe('refresh-token')
    expect(body.expiresIn).toBe(900)
  })

  it('authenticates with an api key and creates a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { 'x-api-key': 'valid.key' },
      payload: { name: 'main', engine: 'baileys' }
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(session.id)
  })

  it('returns 400 on invalid session payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { 'x-api-key': 'valid.key' },
      payload: { name: 'main', engine: 'sms' }
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('bad_request')
  })

  it('maps AppError not-found to 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sessions/22222222-2222-4222-8222-222222222222',
      headers: { 'x-api-key': 'valid.key' }
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('not_found')
  })

  it('rejects a malformed session id with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sessions/not-a-uuid',
      headers: { 'x-api-key': 'valid.key' }
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('bad_request')
  })

  it('rejects an invalid api key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sessions',
      headers: { 'x-api-key': 'wrong.key' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns normalized group metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/sessions/${session.id}/groups/${encodeURIComponent(group.id)}`,
      headers: { 'x-api-key': 'valid.key' }
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(group.id)
    expect(body.participants[0].admin).toBe('superadmin')
  })

  it('rejects an invalid participant action with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sessions/${session.id}/groups/${encodeURIComponent(group.id)}/participants`,
      headers: { 'x-api-key': 'valid.key' },
      payload: { action: 'banana', participants: ['5511'] }
    })
    expect(res.statusCode).toBe(400)
  })
})
