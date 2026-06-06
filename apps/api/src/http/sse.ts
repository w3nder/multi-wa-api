import type { SessionManager } from '@multi-wa/core'
import type { EngineEvent } from '@multi-wa/types'
import type { FastifyReply, FastifyRequest } from 'fastify'

const PING_INTERVAL_MS = 25000

export function streamEvents(
  request: FastifyRequest,
  reply: FastifyReply,
  manager: SessionManager,
  sessionId: string
): void {
  const allowOrigin = reply.getHeader('access-control-allow-origin')
  const allowCredentials = reply.getHeader('access-control-allow-credentials')
  const vary = reply.getHeader('vary')

  reply.hijack()
  const raw = reply.raw
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': String(allowOrigin) } : {}),
    ...(allowCredentials ? { 'Access-Control-Allow-Credentials': String(allowCredentials) } : {}),
    ...(vary ? { Vary: String(vary) } : {})
  })

  const send = (event: EngineEvent): void => {
    raw.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const lastQr = manager.getLastQr(sessionId)
  if (lastQr) send({ type: 'qr', qr: lastQr })

  const unsubscribe = manager.subscribe(sessionId, send)
  const ping = setInterval(() => raw.write(': ping\n\n'), PING_INTERVAL_MS)

  request.raw.on('close', () => {
    clearInterval(ping)
    unsubscribe()
    raw.end()
  })
}
