import { AppError } from '@multi-wa/core'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error instanceof AppError) {
    void reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } })
    return
  }

  const status = error.statusCode ?? 500
  if (status === 429) {
    void reply
      .status(429)
      .send({ error: { code: 'too_many_requests', message: 'rate limit exceeded' } })
    return
  }
  if (status < 500) {
    void reply.status(status).send({ error: { code: 'bad_request', message: error.message } })
    return
  }

  request.log.error({ err: error }, 'unhandled error')
  void reply
    .status(500)
    .send({ error: { code: 'internal_error', message: 'internal server error' } })
}
