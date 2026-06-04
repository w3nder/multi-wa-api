import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Logger } from '../lib/logger'
import { WebhookDispatcher } from './dispatcher'
import type { WebhookRepository, WebhookTarget } from './repository'

const logger = pino({ level: 'silent' }) as unknown as Logger

const messageEvent = {
  type: 'message',
  chat: 'c@s',
  from: 'c@s',
  fromMe: false,
  isGroup: false,
  content: { type: 'text', text: 'hi' }
} as const

interface RetryServer {
  url: (path: string) => string
  requestCount: () => number
  waitForRequests: (n: number, timeoutMs: number) => Promise<void>
  close: () => Promise<void>
}

function startRetryServer(statusFor: (attempt: number) => number | 'hang'): Promise<RetryServer> {
  return new Promise((resolve) => {
    let count = 0
    const waiters: Array<{ n: number; done: () => void }> = []
    const server: Server = createServer((req, res) => {
      count += 1
      const decision = statusFor(count)
      req.on('data', () => undefined)
      req.on('end', () => {
        for (const waiter of waiters) if (count >= waiter.n) waiter.done()
        if (decision !== 'hang') res.writeHead(decision).end('ok')
      })
    })
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        url: (path) => `http://127.0.0.1:${port}${path}`,
        requestCount: () => count,
        waitForRequests: (n, timeoutMs) =>
          new Promise<void>((settle, reject) => {
            if (count >= n) {
              settle()
              return
            }
            const timer = setTimeout(
              () => reject(new Error(`timed out waiting for ${n} requests, got ${count}`)),
              timeoutMs
            )
            waiters.push({
              n,
              done: () => {
                clearTimeout(timer)
                settle()
              }
            })
          }),
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections()
            server.close(() => done())
          })
      })
    })
  })
}

function singleTarget(url: string): WebhookRepository {
  const target: WebhookTarget = { id: 'w1', url, secret: 'topsecretvalue1234', events: ['message'] }
  return { listActiveTargets: async () => [target] } as unknown as WebhookRepository
}

describe('WebhookDispatcher retries', () => {
  it('retries on 5xx and succeeds on the next attempt', async () => {
    const server = await startRetryServer((n) => (n === 1 ? 500 : 200))
    const dispatcher = new WebhookDispatcher(singleTarget(server.url('/hook')), logger, {
      timeoutMs: 1000,
      maxRetries: 2
    })

    dispatcher.dispatch('t1', 's1', messageEvent)
    await server.waitForRequests(2, 5000)
    await new Promise((r) => setTimeout(r, 50))

    expect(server.requestCount()).toBe(2)
    await server.close()
  })

  it('stops after exhausting retries on persistent 5xx', async () => {
    const server = await startRetryServer(() => 500)
    const dispatcher = new WebhookDispatcher(singleTarget(server.url('/hook')), logger, {
      timeoutMs: 1000,
      maxRetries: 2
    })

    dispatcher.dispatch('t1', 's1', messageEvent)
    await server.waitForRequests(3, 6000)
    await new Promise((r) => setTimeout(r, 200))

    expect(server.requestCount()).toBe(3)
    await server.close()
  })

  it('does not retry on 4xx responses', async () => {
    const server = await startRetryServer(() => 400)
    const dispatcher = new WebhookDispatcher(singleTarget(server.url('/hook')), logger, {
      timeoutMs: 1000,
      maxRetries: 3
    })

    dispatcher.dispatch('t1', 's1', messageEvent)
    await server.waitForRequests(1, 3000)
    await new Promise((r) => setTimeout(r, 700))

    expect(server.requestCount()).toBe(1)
    await server.close()
  })

  it('retries after a request timeout and then succeeds', async () => {
    const server = await startRetryServer((n) => (n === 1 ? 'hang' : 200))
    const dispatcher = new WebhookDispatcher(singleTarget(server.url('/hook')), logger, {
      timeoutMs: 200,
      maxRetries: 2
    })

    dispatcher.dispatch('t1', 's1', messageEvent)
    await server.waitForRequests(2, 5000)
    await new Promise((r) => setTimeout(r, 50))

    expect(server.requestCount()).toBe(2)
    await server.close()
  })

  it('caches targets within the TTL and refetches after it expires', async () => {
    const server = await startRetryServer(() => 200)
    let calls = 0
    const target: WebhookTarget = {
      id: 'w1',
      url: server.url('/hook'),
      secret: 'topsecretvalue1234',
      events: ['message']
    }
    const repository = {
      listActiveTargets: async () => {
        calls += 1
        return [target]
      }
    } as unknown as WebhookRepository
    const dispatcher = new WebhookDispatcher(repository, logger, {
      timeoutMs: 1000,
      maxRetries: 0,
      cacheTtlMs: 50
    })

    dispatcher.dispatch('t1', 's1', messageEvent)
    await server.waitForRequests(1, 3000)
    await new Promise((r) => setTimeout(r, 20))

    dispatcher.dispatch('t1', 's1', messageEvent)
    await server.waitForRequests(2, 3000)
    expect(calls).toBe(1)

    await new Promise((r) => setTimeout(r, 80))
    dispatcher.dispatch('t1', 's1', messageEvent)
    await server.waitForRequests(3, 3000)
    expect(calls).toBe(2)

    await server.close()
  })
})
