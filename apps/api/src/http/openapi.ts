import type { MessageContent } from '@multi-wa/types'
import type { OpenAPIV3 } from 'openapi-types'

export const SECURITY: OpenAPIV3.SecurityRequirementObject[] = [{ apiKey: [] }, { bearer: [] }]

const ERROR_EXAMPLES: Record<number, { code: string; message: string }> = {
  400: { code: 'bad_request', message: 'invalid input' },
  401: { code: 'unauthorized', message: 'authentication required' },
  404: { code: 'not_found', message: 'session not found' },
  409: { code: 'conflict', message: 'session is not connected' },
  429: { code: 'too_many_requests', message: 'rate limit exceeded' },
  500: { code: 'internal_error', message: 'internal server error' }
}

const ERROR_SCHEMA: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' } }
    }
  }
}

function errorResponse(status: number): OpenAPIV3.ResponseObject {
  const example = ERROR_EXAMPLES[status] ?? ERROR_EXAMPLES[500]!
  return {
    description: example.code,
    content: { 'application/json': { schema: ERROR_SCHEMA, example: { error: example } } }
  }
}

const MESSAGE_CONTENT_EXAMPLES: Record<string, MessageContent> = {
  text: { type: 'text', text: 'Olá! 👋' },
  image: { type: 'image', media: { url: 'https://example.com/photo.jpg' }, caption: 'Uma foto' },
  video: { type: 'video', media: { url: 'https://example.com/video.mp4' }, caption: 'Um vídeo' },
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

function messageExamples(): Record<string, OpenAPIV3.ExampleObject> {
  const to = '5511999999999@s.whatsapp.net'
  const examples: Record<string, OpenAPIV3.ExampleObject> = {}
  for (const [type, content] of Object.entries(MESSAGE_CONTENT_EXAMPLES)) {
    examples[type] = { summary: `${type} message`, value: { to, content } }
  }
  return examples
}

const INBOUND_MEDIA_SCHEMA: OpenAPIV3.SchemaObject = {
  type: 'object',
  description:
    'Media metadata. In `none` storage mode it also carries the download pointers (directPath, url, mediaKey, fileEncSha256, fileSha256) so the client can fetch bytes via POST /sessions/:id/media/download. In `s3` mode the pointers are dropped and `url` is the public link with `stored: "s3"`.',
  properties: {
    mimetype: { type: 'string' },
    size: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
    seconds: { type: 'number' },
    directPath: { type: 'string' },
    url: { type: 'string' },
    mediaKey: { type: 'string' },
    fileEncSha256: { type: 'string' },
    fileSha256: { type: 'string' },
    stored: { type: 'string', enum: ['s3'] }
  }
}

const INBOUND_CONTENT_SCHEMA: OpenAPIV3.SchemaObject = {
  description:
    'Normalized message content, discriminated by `type` (same shapes as the send endpoint). type is one of: text, image, video, audio, document, sticker, location, contact, reaction, poll, buttons_response, list_response, unknown. Media types (image/video/audio/document/sticker) carry a `media` metadata object; bytes are fetched separately.',
  oneOf: [
    {
      type: 'object',
      required: ['type', 'text'],
      properties: { type: { type: 'string', enum: ['text'] }, text: { type: 'string' } }
    },
    {
      type: 'object',
      required: ['type', 'media'],
      properties: {
        type: { type: 'string', enum: ['image', 'video', 'audio', 'document', 'sticker'] },
        media: INBOUND_MEDIA_SCHEMA,
        caption: { type: 'string' },
        fileName: { type: 'string' },
        voice: { type: 'boolean' },
        gif: { type: 'boolean' },
        animated: { type: 'boolean' },
        pageCount: { type: 'number' }
      }
    },
    {
      type: 'object',
      required: ['type', 'latitude', 'longitude'],
      properties: {
        type: { type: 'string', enum: ['location'] },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        name: { type: 'string' },
        address: { type: 'string' }
      }
    },
    {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['contact'] },
        displayName: { type: 'string' },
        vcard: { type: 'string' }
      }
    },
    {
      type: 'object',
      required: ['type', 'emoji', 'target'],
      properties: {
        type: { type: 'string', enum: ['reaction'] },
        emoji: { type: 'string', nullable: true },
        target: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            fromMe: { type: 'boolean' },
            participant: { type: 'string' }
          }
        }
      }
    },
    {
      type: 'object',
      required: ['type', 'question', 'options'],
      properties: {
        type: { type: 'string', enum: ['poll'] },
        question: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } },
        selectableCount: { type: 'number' }
      }
    },
    {
      type: 'object',
      required: ['type', 'id'],
      properties: {
        type: { type: 'string', enum: ['buttons_response'] },
        id: { type: 'string' },
        text: { type: 'string' }
      }
    },
    {
      type: 'object',
      required: ['type', 'rowId'],
      properties: {
        type: { type: 'string', enum: ['list_response'] },
        rowId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' }
      }
    },
    {
      type: 'object',
      required: ['type'],
      properties: { type: { type: 'string', enum: ['unknown'] }, kind: { type: 'string' } }
    }
  ]
}

const WEBHOOK_DELIVERY_SCHEMA: OpenAPIV3.SchemaObject = {
  oneOf: [
    {
      type: 'object',
      required: ['type', 'qr'],
      properties: { type: { type: 'string', enum: ['qr'] }, qr: { type: 'string' } }
    },
    {
      type: 'object',
      required: ['type', 'status'],
      properties: {
        type: { type: 'string', enum: ['connection'] },
        status: {
          type: 'string',
          enum: ['created', 'connecting', 'qr', 'connected', 'disconnected', 'logged_out']
        },
        meJid: { type: 'string' }
      }
    },
    {
      type: 'object',
      required: ['type', 'chat', 'from', 'fromMe', 'isGroup', 'content'],
      properties: {
        type: { type: 'string', enum: ['message'] },
        id: { type: 'string' },
        chat: { type: 'string' },
        from: { type: 'string' },
        fromMe: { type: 'boolean' },
        isGroup: { type: 'boolean' },
        participant: { type: 'string' },
        pushName: { type: 'string' },
        timestamp: { type: 'number' },
        content: INBOUND_CONTENT_SCHEMA,
        mentions: {
          type: 'array',
          items: { type: 'string' },
          description: 'jids mentioned in the message (omitted when none).'
        },
        quoted: {
          type: 'object',
          description: 'Set when the message replies to/quotes another message.',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'id of the quoted message' },
            participant: { type: 'string', description: 'author jid of the quoted message' },
            content: INBOUND_CONTENT_SCHEMA
          }
        }
      }
    },
    {
      type: 'object',
      required: ['type', 'ids', 'chat', 'isGroup', 'status'],
      properties: {
        type: { type: 'string', enum: ['ack'] },
        ids: { type: 'array', items: { type: 'string' } },
        chat: { type: 'string' },
        fromMe: { type: 'boolean' },
        isGroup: { type: 'boolean' },
        participant: { type: 'string' },
        status: {
          type: 'string',
          enum: ['pending', 'sent', 'delivered', 'read', 'played', 'error']
        },
        timestamp: { type: 'number' }
      }
    },
    {
      type: 'object',
      required: ['type', 'chat', 'status'],
      properties: {
        type: { type: 'string', enum: ['presence'] },
        chat: { type: 'string' },
        from: { type: 'string' },
        status: {
          type: 'string',
          enum: ['available', 'unavailable', 'composing', 'recording', 'paused']
        },
        lastSeen: { type: 'number', nullable: true }
      }
    }
  ]
}

const WEBHOOK_DELIVERY_EXAMPLES: Record<string, OpenAPIV3.ExampleObject> = {
  qr: { summary: 'qr event', value: { type: 'qr', qr: '2@abc123...' } },
  connected: {
    summary: 'connection event (connected)',
    value: { type: 'connection', status: 'connected', meJid: '5511999999999@s.whatsapp.net' }
  },
  disconnected: {
    summary: 'connection event (disconnected)',
    value: { type: 'connection', status: 'disconnected' }
  },
  logged_out: {
    summary: 'connection event (logged out)',
    value: { type: 'connection', status: 'logged_out' }
  },
  message_text: {
    summary: 'message event (text, direct)',
    value: {
      type: 'message',
      id: '3EB0...',
      chat: '5511888888888@s.whatsapp.net',
      from: '5511888888888@s.whatsapp.net',
      fromMe: false,
      isGroup: false,
      pushName: 'João',
      timestamp: 1730000000,
      content: { type: 'text', text: 'Oi!' }
    }
  },
  message_image_group: {
    summary: 'message event (image, group)',
    value: {
      type: 'message',
      id: '3EB0...',
      chat: '120363000000000000@g.us',
      from: '5511888888888@s.whatsapp.net',
      fromMe: false,
      isGroup: true,
      participant: '5511888888888@s.whatsapp.net',
      timestamp: 1730000000,
      content: { type: 'image', media: { mimetype: 'image/jpeg', size: 12345 }, caption: 'Olha!' }
    }
  },
  message_reply_mention_group: {
    summary: 'message event (reply with mention, group)',
    value: {
      type: 'message',
      id: '3EB0...',
      chat: '120363000000000000@g.us',
      from: '5511888888888@s.whatsapp.net',
      fromMe: false,
      isGroup: true,
      participant: '5511888888888@s.whatsapp.net',
      timestamp: 1730000000,
      content: { type: 'text', text: '@5511777777777 isso mesmo!' },
      mentions: ['5511777777777@s.whatsapp.net'],
      quoted: {
        id: '3EA9...',
        participant: '5511777777777@s.whatsapp.net',
        content: { type: 'text', text: 'alguém confirma?' }
      }
    }
  },
  ack: {
    summary: 'ack event (read)',
    value: {
      type: 'ack',
      ids: ['3EB0...'],
      chat: '5511888888888@s.whatsapp.net',
      fromMe: true,
      isGroup: false,
      status: 'read',
      timestamp: 1730000050
    }
  },
  presence: {
    summary: 'presence event (typing)',
    value: { type: 'presence', chat: '5511888888888@s.whatsapp.net', status: 'composing' }
  }
}

const WEBHOOK_DESCRIPTION = [
  'Deliveries are signed with HMAC-SHA256 in the X-Signature header.',
  '',
  'Each delivery is a JSON POST to your `url` with one of these payloads:',
  '- `qr`: new QR code to scan.',
  '- `connection`: channel/connection state (`connecting`, `qr`, `connected`, `disconnected`, `logged_out`).',
  '- `message`: inbound/outbound messages of any type. `content` is normalized and discriminated by `type` (text, image, video, audio, document, sticker, location, contact, reaction, poll, buttons_response, list_response). Group messages have `isGroup: true`, `chat` ending in `@g.us` and `participant` set to the author jid. `mentions` lists the jids mentioned in the message (omitted when none); `quoted` carries the replied-to message (`id`, `participant`, normalized `content`) when the message is a reply. Media payloads carry metadata only; fetch bytes separately.',
  '- `ack`: message delivery status for the given `ids` (`pending`, `sent`, `delivered`, `read`, `played`, `error`).',
  '- `presence`: chat presence (`available`, `unavailable`, `composing`, `recording`, `paused`).',
  '',
  'Payloads are identical across the zapo and baileys engines. See the WebhookDelivery schema for full shapes and examples.'
].join('\n')

function decorateWebhooks(doc: OpenAPIV3.Document): void {
  doc.components ??= {}
  doc.components.schemas ??= {}
  doc.components.schemas.WebhookDelivery = {
    ...WEBHOOK_DELIVERY_SCHEMA,
    example: WEBHOOK_DELIVERY_EXAMPLES.message_text!.value
  } as OpenAPIV3.SchemaObject
  const post = doc.paths?.['/webhooks/']?.post as OpenAPIV3.OperationObject | undefined
  if (post) post.description = WEBHOOK_DESCRIPTION
}

function decorateMediaDownload(doc: OpenAPIV3.Document): void {
  const post = doc.paths?.['/sessions/{id}/media/download']?.post as
    | OpenAPIV3.OperationObject
    | undefined
  if (!post) return
  post.responses[200] = {
    description: 'Raw media bytes',
    content: {
      'application/octet-stream': { schema: { type: 'string', format: 'binary' } }
    }
  }
}

export function decorateOpenApi(doc: OpenAPIV3.Document): OpenAPIV3.Document {
  for (const path of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(path ?? {})) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue
      const op = operation as OpenAPIV3.OperationObject
      const secured = Array.isArray(op.security) && op.security.length > 0
      const codes = secured ? [400, 401, 404, 409, 429, 500] : [400, 429, 500]
      for (const code of codes) {
        op.responses[code] ??= errorResponse(code)
      }
    }
  }

  const media = doc.paths?.['/sessions/{id}/messages']?.post?.requestBody as
    | OpenAPIV3.RequestBodyObject
    | undefined
  const json = media?.content?.['application/json']
  if (json) json.examples = messageExamples()

  decorateWebhooks(doc)
  decorateMediaDownload(doc)

  return doc
}
