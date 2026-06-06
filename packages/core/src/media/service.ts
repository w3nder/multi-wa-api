import type { Readable } from 'node:stream'
import type { EngineEvent, InboundContent, InboundMedia, MediaRef } from '@multi-wa/types'
import { errors } from '../lib/errors'
import type { Logger } from '../lib/logger'
import type { SessionManager } from '../sessions/manager'
import type { TenantRepository } from '../tenants/repository'
import type { MediaStorage } from './storage'

type MediaContent = Extract<InboundContent, { media: InboundMedia }>

export interface MediaServiceDeps {
  manager: SessionManager
  tenants: TenantRepository
  storage: MediaStorage | null
  defaultMode: 'none' | 's3'
  logger: Logger
}

export class MediaService {
  constructor(private readonly deps: MediaServiceDeps) {}

  async download(_tenantId: string, sessionId: string, ref: MediaRef): Promise<Readable> {
    const engine = this.deps.manager.getEngine(sessionId)
    if (!engine) throw errors.conflict('session is not connected')
    return engine.downloadMedia(ref)
  }

  async resolveForDispatch(
    tenantId: string,
    sessionId: string,
    event: EngineEvent
  ): Promise<EngineEvent> {
    if (event.type !== 'message') return event
    const content = mediaContentOf(event.content)
    if (!content || !this.deps.storage) return event
    if ((await this.effectiveMode(tenantId)) !== 's3') return event
    const engine = this.deps.manager.getEngine(sessionId)
    if (!engine) return event

    try {
      const ref: MediaRef = { type: content.type, media: content.media }
      const stream = await engine.downloadMedia(ref)
      const buffer = await streamToBuffer(stream)
      const key = buildKey(tenantId, sessionId, event.id ?? event.timestamp, content.media.mimetype)
      const { url } = await this.deps.storage.put(key, buffer, content.media.mimetype)
      const media: InboundMedia = {
        mimetype: content.media.mimetype,
        size: content.media.size,
        width: content.media.width,
        height: content.media.height,
        seconds: content.media.seconds,
        url,
        stored: 's3'
      }
      return { ...event, content: { ...content, media } }
    } catch (error) {
      this.deps.logger.warn({ err: error, session: sessionId }, 'media s3 upload failed')
      return event
    }
  }

  private async effectiveMode(tenantId: string): Promise<'none' | 's3'> {
    const mode = await this.deps.tenants.getMediaStorage(tenantId)
    return mode === 'default' ? this.deps.defaultMode : mode
  }
}

function mediaContentOf(content: InboundContent): MediaContent | null {
  switch (content.type) {
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      return content
    default:
      return null
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function buildKey(
  tenantId: string,
  sessionId: string,
  id: string | number | undefined,
  mimetype: string | undefined
): string {
  return `${tenantId}/${sessionId}/${id ?? 'media'}.${extFromMime(mimetype)}`
}

function extFromMime(mimetype: string | undefined): string {
  if (!mimetype) return 'bin'
  const subtype = mimetype.split(';')[0]?.split('/')[1]
  return subtype && subtype.length > 0 ? subtype : 'bin'
}
