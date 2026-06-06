import type { InboundContent, MediaSource, MessageContent } from '@multi-wa/types'
import type { WaSendMessageContent } from 'zapo-js'

async function resolveMedia(media: MediaSource): Promise<Uint8Array> {
  if ('base64' in media) return new Uint8Array(Buffer.from(media.base64, 'base64'))
  const response = await fetch(media.url)
  if (!response.ok) throw new Error(`failed to fetch media: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

const DEFAULT_MIME: Record<string, string> = {
  image: 'image/jpeg',
  video: 'video/mp4',
  audio: 'audio/ogg; codecs=opus',
  document: 'application/octet-stream',
  sticker: 'image/webp'
}

export async function toZapoContent(content: MessageContent): Promise<WaSendMessageContent> {
  switch (content.type) {
    case 'text':
      return { type: 'text', text: content.text }
    case 'image':
      return {
        type: 'image',
        media: await resolveMedia(content.media),
        mimetype: DEFAULT_MIME.image,
        caption: content.caption
      }
    case 'video':
      return {
        type: 'video',
        media: await resolveMedia(content.media),
        mimetype: DEFAULT_MIME.video,
        caption: content.caption
      }
    case 'audio':
      return {
        type: 'audio',
        media: await resolveMedia(content.media),
        mimetype: DEFAULT_MIME.audio,
        ptt: content.voice ?? false
      }
    case 'document':
      return {
        type: 'document',
        media: await resolveMedia(content.media),
        mimetype: content.mimetype ?? DEFAULT_MIME.document,
        fileName: content.filename,
        caption: content.caption
      }
    case 'sticker':
      return {
        type: 'sticker',
        media: await resolveMedia(content.media),
        mimetype: DEFAULT_MIME.sticker
      }
    case 'location':
      return {
        locationMessage: {
          degreesLatitude: content.latitude,
          degreesLongitude: content.longitude,
          name: content.name,
          address: content.address
        }
      }
    case 'contact':
      return {
        contactMessage: {
          displayName: content.fullName,
          vcard: buildVcard(content.fullName, content.phone)
        }
      }
  }
}

function buildVcard(fullName: string, phone: string): string {
  const waid = phone.replace(/[^0-9]/g, '')
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fullName}`,
    `TEL;type=CELL;type=VOICE;waid=${waid}:${phone}`,
    'END:VCARD'
  ].join('\n')
}

export function toInboundContent(content: MessageContent): InboundContent {
  switch (content.type) {
    case 'text':
      return { type: 'text', text: content.text }
    case 'image':
      return {
        type: 'image',
        media: { mimetype: DEFAULT_MIME.image },
        caption: content.caption
      }
    case 'video':
      return {
        type: 'video',
        media: { mimetype: DEFAULT_MIME.video },
        caption: content.caption
      }
    case 'audio':
      return {
        type: 'audio',
        media: { mimetype: DEFAULT_MIME.audio },
        voice: content.voice ?? false
      }
    case 'document':
      return {
        type: 'document',
        media: { mimetype: content.mimetype ?? DEFAULT_MIME.document },
        fileName: content.filename,
        caption: content.caption
      }
    case 'sticker':
      return {
        type: 'sticker',
        media: { mimetype: DEFAULT_MIME.sticker }
      }
    case 'location':
      return {
        type: 'location',
        latitude: content.latitude,
        longitude: content.longitude,
        name: content.name,
        address: content.address
      }
    case 'contact':
      return {
        type: 'contact',
        displayName: content.fullName,
        vcard: buildVcard(content.fullName, content.phone)
      }
  }
}
