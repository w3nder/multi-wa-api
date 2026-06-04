import { createHmac } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { pino } from 'pino'
import type { Logger } from '../lib/logger'
import { describe, expect, it } from 'vitest'
import { WebhookDispatcher } from './dispatcher'
import type { WebhookRepository, WebhookTarget } from './repository'

const logger = pino({ level: 'silent' }) as unknown as Logger

interface Captured {
  headers: Record<string, string | string[] | undefined>
  body: string
}

function startServer(): Promise<{ port: number; next: Promise<Captured>; close: () => void }> {
  return new Promise((resolve) => {
    let resolveNext!: (value: Captured) => void
    const next = new Promise<Captured>((r) => (resolveNext = r))
    const server: Server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        res.writeHead(200).end('ok')
        resolveNext({ headers: req.headers, body })
      })
    })
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port
      resolve({ port, next, close: () => server.close() })
    })
  })
}

describe('WebhookDispatcher', () => {
  it('delivers a signed payload to subscribed targets', async () => {
    const server = await startServer()
    const secret = 'topsecretvalue1234'
    const target: WebhookTarget = {
      id: 'w1',
      url: `http://127.0.0.1:${server.port}/hook`,
      secret,
      events: ['message']
    }
    const repository = {
      listActiveTargets: async () => [target]
    } as unknown as WebhookRepository

    const dispatcher = new WebhookDispatcher(repository, logger, {
      timeoutMs: 2000,
      maxRetries: 0
    })

    dispatcher.dispatch('tenant1', 's1', {
      type: 'message',
      chat: 'c@s',
      from: 'c@s',
      fromMe: false,
      isGroup: false,
      content: { type: 'text', text: 'hi' }
    })

    const received = await server.next
    server.close()

    const expectedBody = JSON.stringify({
      sessionId: 's1',
      event: {
        type: 'message',
        chat: 'c@s',
        from: 'c@s',
        fromMe: false,
        isGroup: false,
        content: { type: 'text', text: 'hi' }
      }
    })
    expect(received.body).toBe(expectedBody)
    const expectedSig = `sha256=${createHmac('sha256', secret).update(expectedBody).digest('hex')}`
    expect(received.headers['x-signature']).toBe(expectedSig)
    expect(received.headers['x-event-type']).toBe('message')
    expect(received.headers['x-session-id']).toBe('s1')
  })

  it('skips targets not subscribed to the event type', async () => {
    let calls = 0
    const repository = {
      listActiveTargets: async () => {
        calls += 1
        return [{ id: 'w1', url: 'http://127.0.0.1:1/none', secret: 'x', events: ['qr'] }]
      }
    } as unknown as WebhookRepository
    const dispatcher = new WebhookDispatcher(repository, logger, { timeoutMs: 500, maxRetries: 0 })
    dispatcher.dispatch('tenant1', 's1', { type: 'connection', status: 'connected' })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toBe(1)
  })
})
