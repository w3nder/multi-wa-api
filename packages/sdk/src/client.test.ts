import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, WaApiError } from './index'

interface Recorded {
  method: string
  url: string
  headers: IncomingMessage['headers']
  body: string
}

let server: Server
let baseUrl: string
let lastRequest: Recorded | undefined

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
  })
}

beforeAll(async () => {
  server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const body = await readBody(req)
    lastRequest = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body }

    if (req.url?.endsWith('/events')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write(`data: ${JSON.stringify({ type: 'qr', qr: 'QR1' })}\n\n`)
      res.write(': ping\n\n')
      res.write(`data: ${JSON.stringify({ type: 'connection', status: 'connected' })}\n\n`)
      res.end()
      return
    }
    if (req.url?.includes('fail')) {
      res.writeHead(409, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'conflict', message: 'not connected' } }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ id: 'msg-1' }))
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

describe('sdk client', () => {
  it('builds the text payload and sends the api key header', async () => {
    const client = createClient({ baseUrl, apiKey: 'prefix.secret' })
    const result = await client.messages.sendText('s1', '5511999999999', 'hello')
    expect(result).toEqual({ id: 'msg-1' })
    expect(lastRequest?.method).toBe('POST')
    expect(lastRequest?.url).toBe('/sessions/s1/messages')
    expect(lastRequest?.headers['x-api-key']).toBe('prefix.secret')
    expect(JSON.parse(lastRequest!.body)).toEqual({
      to: '5511999999999',
      content: { type: 'text', text: 'hello' }
    })
  })

  it('builds image payload from a url', async () => {
    const client = createClient({ baseUrl, accessToken: 'jwt-token' })
    await client.messages.sendImage('s1', '551199', { url: 'https://x/y.jpg' }, 'cap')
    expect(lastRequest?.headers.authorization).toBe('Bearer jwt-token')
    expect(JSON.parse(lastRequest!.body)).toEqual({
      to: '551199',
      content: { type: 'image', media: { url: 'https://x/y.jpg' }, caption: 'cap' }
    })
  })

  it('throws WaApiError on non-2xx responses', async () => {
    const client = createClient({ baseUrl })
    await expect(client.sessions.connect('fail')).rejects.toBeInstanceOf(WaApiError)
    await expect(client.sessions.connect('fail')).rejects.toMatchObject({
      status: 409,
      message: 'not connected'
    })
  })

  it('streams and parses SSE events', async () => {
    const client = createClient({ baseUrl, apiKey: 'k.k' })
    const events = []
    for await (const event of client.sessions.events('s1')) events.push(event)
    expect(events).toEqual([
      { type: 'qr', qr: 'QR1' },
      { type: 'connection', status: 'connected' }
    ])
  })
})
