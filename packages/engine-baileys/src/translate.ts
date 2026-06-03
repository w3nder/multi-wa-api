import type { MediaSource, MessageContent } from '@multi-wa/types'
import type { AnyMessageContent, WAMediaUpload } from 'baileys'

function mediaInput(media: MediaSource): WAMediaUpload {
  if ('url' in media) return { url: media.url }
  return Buffer.from(media.base64, 'base64')
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

export function toBaileysContent(content: MessageContent): AnyMessageContent {
  switch (content.kind) {
    case 'text':
      return { text: content.text }
    case 'image':
      return { image: mediaInput(content.media), caption: content.caption }
    case 'video':
      return { video: mediaInput(content.media), caption: content.caption }
    case 'audio':
      return { audio: mediaInput(content.media), ptt: content.voice ?? false }
    case 'document':
      return {
        document: mediaInput(content.media),
        fileName: content.filename ?? 'file',
        mimetype: content.mimetype ?? 'application/octet-stream',
        caption: content.caption
      }
    case 'sticker':
      return { sticker: mediaInput(content.media) }
    case 'location':
      return {
        location: {
          degreesLatitude: content.latitude,
          degreesLongitude: content.longitude,
          name: content.name,
          address: content.address
        }
      }
    case 'contact':
      return {
        contacts: {
          contacts: [{ displayName: content.fullName, vcard: buildVcard(content.fullName, content.phone) }]
        }
      }
  }
}
