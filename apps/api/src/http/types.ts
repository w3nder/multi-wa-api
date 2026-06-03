import type { Principal } from '@multi-wa/core'

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; tenantId: string }
    user: { sub: string; tenantId: string }
  }
}
