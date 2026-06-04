import { messageContentSchema } from '@multi-wa/types'
import type { FastifySchema } from 'fastify'
import type { ZodSchema } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export const SECURITY = [{ apiKey: [] }, { bearer: [] }]

export const ID_PARAMS = {
  type: 'object',
  properties: { id: { type: 'string', description: 'Session or resource id' } },
  required: ['id']
} as const

const ERROR_EXAMPLES: Record<number, { code: string; message: string }> = {
  400: { code: 'bad_request', message: 'invalid input' },
  401: { code: 'unauthorized', message: 'authentication required' },
  403: { code: 'forbidden', message: 'forbidden' },
  404: { code: 'not_found', message: 'session not found' },
  409: { code: 'conflict', message: 'session is not connected' },
  422: { code: 'unprocessable', message: 'unprocessable entity' },
  429: { code: 'too_many_requests', message: 'rate limit exceeded' },
  500: { code: 'internal_error', message: 'internal server error' }
}

export function errorResponse(status: number): Record<string, unknown> {
  const example = ERROR_EXAMPLES[status] ?? ERROR_EXAMPLES[500]!
  return {
    description: example.code,
    type: 'object',
    additionalProperties: false,
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' }
        }
      }
    },
    example: { error: example }
  }
}

export const NO_CONTENT = { type: 'null', description: 'No content' } as const

export function jsonSchema(schema: ZodSchema): Record<string, unknown> {
  const result = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none'
  }) as Record<string, unknown>
  delete result.$schema
  return result
}

export function arrayOf(schema: ZodSchema): Record<string, unknown> {
  return { type: 'array', items: jsonSchema(schema) }
}

interface UnionBranch {
  title?: string
  example?: unknown
  properties?: { type?: { const?: string; enum?: string[] } }
}

export const MESSAGE_CONTENT_EXAMPLES: Record<string, unknown> = {
  text: { type: 'text', text: 'Olá! 👋' },
  image: {
    type: 'image',
    media: { url: 'https://example.com/photo.jpg' },
    caption: 'Uma foto'
  },
  video: {
    type: 'video',
    media: { url: 'https://example.com/video.mp4' },
    caption: 'Um vídeo'
  },
  audio: { type: 'audio', media: { url: 'https://example.com/audio.ogg' }, voice: true },
  document: {
    type: 'document',
    media: { url: 'https://example.com/file.pdf' },
    filename: 'file.pdf',
    mimetype: 'application/pdf'
  },
  sticker: { type: 'sticker', media: { base64: 'UklGR...' } },
  location: {
    type: 'location',
    latitude: -23.55052,
    longitude: -46.633308,
    name: 'São Paulo',
    address: 'Av. Paulista, 1000'
  },
  contact: { type: 'contact', fullName: 'João Silva', phone: '+5511999999999' }
}

export function messageContentJson(): Record<string, unknown> {
  const schema = jsonSchema(messageContentSchema) as { anyOf?: UnionBranch[] }
  for (const branch of schema.anyOf ?? []) {
    const tag = branch.properties?.type?.const ?? branch.properties?.type?.enum?.[0]
    if (tag) {
      branch.title = tag
      branch.example = MESSAGE_CONTENT_EXAMPLES[tag]
    }
  }
  return schema
}

export function messageRequestExamples(): Record<string, { summary: string; value: unknown }> {
  const to = '5511999999999@s.whatsapp.net'
  const examples: Record<string, { summary: string; value: unknown }> = {}
  for (const [type, content] of Object.entries(MESSAGE_CONTENT_EXAMPLES)) {
    examples[type] = { summary: `${type} message`, value: { to, content } }
  }
  return examples
}

export function sendMessageBodyJson(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['to', 'content'],
    properties: {
      to: { type: 'string', example: '5511999999999@s.whatsapp.net' },
      content: messageContentJson()
    },
    example: { to: '5511999999999@s.whatsapp.net', content: MESSAGE_CONTENT_EXAMPLES.text }
  }
}

export interface RouteSchemaInput {
  tags: string[]
  summary: string
  description?: string
  body?: ZodSchema
  bodyJson?: object
  params?: object
  response?: Record<number, object>
  secured?: boolean
}

export function routeSchema(input: RouteSchemaInput): FastifySchema {
  const schema: FastifySchema = { tags: input.tags, summary: input.summary }
  if (input.description) schema.description = input.description
  if (input.bodyJson) schema.body = input.bodyJson
  else if (input.body) schema.body = jsonSchema(input.body)
  if (input.params) schema.params = input.params
  if (input.secured) (schema as { security?: unknown }).security = SECURITY

  const response: Record<number, object> = { ...(input.response ?? {}) }
  const errorCodes = input.secured ? [400, 401, 404, 409, 429, 500] : [400, 429, 500]
  for (const code of errorCodes) {
    if (!(code in response)) response[code] = errorResponse(code)
  }
  schema.response = response
  return schema
}
