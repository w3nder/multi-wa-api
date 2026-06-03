import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'

export function healthRoutes(app: FastifyInstance, container: Container): void {
  app.get('/health', async () => ({ status: 'ok' }))

  app.get('/ready', async (_request, reply) => {
    try {
      await container.pool.query('SELECT 1')
      return { status: 'ready' }
    } catch {
      return reply.status(503).send({ status: 'unavailable' })
    }
  })
}
