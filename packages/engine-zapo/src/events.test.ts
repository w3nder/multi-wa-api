import { describe, expect, it } from 'vitest'
import type {
  WaIncomingChatstateEvent,
  WaIncomingMessageEvent,
  WaIncomingPresenceEvent,
  WaIncomingReceiptEvent
} from 'zapo-js'
import {
  mapZapoChatstate,
  mapZapoContent,
  mapZapoContext,
  mapZapoMessageEvent,
  mapZapoPresence,
  mapZapoReceipt
} from './events'

const rawNode = { tag: 'x', attrs: {} }

describe('mapZapoContent', () => {
  it('maps text variants', () => {
    expect(mapZapoContent({ conversation: 'hi' })).toEqual({ type: 'text', text: 'hi' })
    expect(mapZapoContent({ extendedTextMessage: { text: 'link' } })).toEqual({
      type: 'text',
      text: 'link'
    })
    expect(mapZapoContent({ extendedTextMessage: {} })).toEqual({ type: 'text', text: '' })
  })

  it('maps image with and without caption', () => {
    expect(
      mapZapoContent({ imageMessage: { mimetype: 'image/jpeg', fileLength: 10, caption: 'c' } })
    ).toMatchObject({ type: 'image', caption: 'c', media: { mimetype: 'image/jpeg', size: 10 } })
    expect(mapZapoContent({ imageMessage: {} })).toEqual({
      type: 'image',
      media: {
        mimetype: undefined,
        size: undefined,
        width: undefined,
        height: undefined,
        seconds: undefined
      },
      caption: undefined
    })
  })

  it('maps video plain, gif and ptv', () => {
    expect(mapZapoContent({ videoMessage: { caption: 'v', gifPlayback: true } })).toMatchObject({
      type: 'video',
      caption: 'v',
      gif: true
    })
    expect(mapZapoContent({ ptvMessage: { mimetype: 'video/mp4' } })).toMatchObject({
      type: 'video'
    })
  })

  it('maps audio voice and non-voice', () => {
    expect(mapZapoContent({ audioMessage: { ptt: true } })).toMatchObject({
      type: 'audio',
      voice: true
    })
    expect(mapZapoContent({ audioMessage: {} })).toMatchObject({ type: 'audio', voice: undefined })
  })

  it('maps document with metadata', () => {
    expect(
      mapZapoContent({
        documentMessage: {
          mimetype: 'application/pdf',
          fileLength: 9,
          fileName: 'a.pdf',
          pageCount: 2
        }
      })
    ).toMatchObject({ type: 'document', fileName: 'a.pdf', pageCount: 2 })
  })

  it('maps sticker', () => {
    expect(mapZapoContent({ stickerMessage: { isAnimated: true } })).toMatchObject({
      type: 'sticker',
      animated: true
    })
  })

  it('maps location and live location', () => {
    expect(
      mapZapoContent({ locationMessage: { degreesLatitude: -1, degreesLongitude: -2, name: 'p' } })
    ).toMatchObject({ type: 'location', latitude: -1, longitude: -2, name: 'p' })
    expect(mapZapoContent({ liveLocationMessage: {} })).toEqual({
      type: 'location',
      latitude: 0,
      longitude: 0
    })
  })

  it('maps contact', () => {
    expect(mapZapoContent({ contactMessage: { displayName: 'J', vcard: 'V' } })).toEqual({
      type: 'contact',
      displayName: 'J',
      vcard: 'V'
    })
  })

  it('maps reaction with null emoji fallback', () => {
    expect(mapZapoContent({ reactionMessage: { key: { id: 'X' } } })).toEqual({
      type: 'reaction',
      emoji: null,
      target: { id: 'X', fromMe: undefined, participant: undefined }
    })
  })

  it('maps poll (v1 and v2)', () => {
    expect(
      mapZapoContent({ pollCreationMessage: { name: 'Q', options: [{ optionName: 'A' }] } })
    ).toMatchObject({ type: 'poll', question: 'Q', options: ['A'] })
    expect(mapZapoContent({ pollCreationMessageV2: { name: 'Q2', options: [] } })).toMatchObject({
      type: 'poll',
      question: 'Q2',
      options: []
    })
  })

  it('maps button and list responses', () => {
    expect(mapZapoContent({ buttonsResponseMessage: { selectedButtonId: '1' } })).toMatchObject({
      type: 'buttons_response',
      id: '1'
    })
    expect(
      mapZapoContent({ listResponseMessage: { singleSelectReply: { selectedRowId: 'r' } } })
    ).toMatchObject({ type: 'list_response', rowId: 'r' })
  })

  it('unwraps every wrapper kind', () => {
    expect(mapZapoContent({ ephemeralMessage: { message: { conversation: 'a' } } })).toMatchObject({
      type: 'text',
      text: 'a'
    })
    expect(mapZapoContent({ viewOnceMessage: { message: { conversation: 'b' } } })).toMatchObject({
      type: 'text',
      text: 'b'
    })
    expect(mapZapoContent({ viewOnceMessageV2: { message: { conversation: 'c' } } })).toMatchObject(
      {
        type: 'text',
        text: 'c'
      }
    )
    expect(
      mapZapoContent({ viewOnceMessageV2Extension: { message: { conversation: 'd' } } })
    ).toMatchObject({ type: 'text', text: 'd' })
    expect(
      mapZapoContent({ documentWithCaptionMessage: { message: { conversation: 'e' } } })
    ).toMatchObject({ type: 'text', text: 'e' })
    expect(mapZapoContent({ editedMessage: { message: { conversation: 'f' } } })).toMatchObject({
      type: 'text',
      text: 'f'
    })
  })

  it('falls back to unknown for empty and null', () => {
    expect(mapZapoContent({})).toEqual({ type: 'unknown' })
    expect(mapZapoContent(null)).toEqual({ type: 'unknown' })
    expect(mapZapoContent(undefined)).toEqual({ type: 'unknown' })
  })

  it('includes base64 download pointers in media', () => {
    const out = mapZapoContent({
      documentMessage: {
        mediaKey: new Uint8Array([9, 8]),
        directPath: '/v/d',
        url: 'https://cdn/d',
        fileEncSha256: new Uint8Array([7])
      }
    })
    expect(out).toMatchObject({
      type: 'document',
      media: {
        directPath: '/v/d',
        url: 'https://cdn/d',
        mediaKey: Buffer.from([9, 8]).toString('base64'),
        fileEncSha256: Buffer.from([7]).toString('base64')
      }
    })
  })
})

describe('mapZapoMessageEvent', () => {
  const base = (over: Partial<WaIncomingMessageEvent>): WaIncomingMessageEvent => ({
    rawNode,
    key: {
      remoteJid: 'c@s.whatsapp.net',
      id: 'M1',
      fromMe: false,
      isGroup: false,
      isBroadcast: false,
      isNewsletter: false,
      senderDevice: 0
    },
    ...over
  })

  it('normalizes a direct message', () => {
    expect(
      mapZapoMessageEvent(
        base({ pushName: 'Ana', timestampSeconds: 1, message: { conversation: 'oi' } })
      )
    ).toEqual({
      type: 'message',
      id: 'M1',
      chat: 'c@s.whatsapp.net',
      from: 'c@s.whatsapp.net',
      fromMe: false,
      isGroup: false,
      participant: undefined,
      pushName: 'Ana',
      timestamp: 1,
      content: { type: 'text', text: 'oi' }
    })
  })

  it('uses participant as from in groups', () => {
    const event = mapZapoMessageEvent(
      base({
        key: {
          remoteJid: '123@g.us',
          id: 'M2',
          fromMe: false,
          participant: '55@s.whatsapp.net',
          isGroup: true,
          isBroadcast: false,
          isNewsletter: false,
          senderDevice: 0
        }
      })
    )
    expect(event.from).toBe('55@s.whatsapp.net')
    expect(event.isGroup).toBe(true)
    expect(event.content).toEqual({ type: 'unknown' })
  })

  it('includes mentions and quoted when present, omits them otherwise', () => {
    const plain = mapZapoMessageEvent(base({ message: { conversation: 'oi' } }))
    expect(plain).not.toHaveProperty('mentions')
    expect(plain).not.toHaveProperty('quoted')

    const reply = mapZapoMessageEvent(
      base({
        message: {
          extendedTextMessage: {
            text: '@77 sim',
            contextInfo: {
              mentionedJid: ['77@s.whatsapp.net'],
              stanzaId: 'ORIG1',
              participant: '77@s.whatsapp.net',
              quotedMessage: { conversation: 'alguém confirma?' }
            }
          }
        }
      })
    )
    expect(reply.mentions).toEqual(['77@s.whatsapp.net'])
    expect(reply.quoted).toEqual({
      id: 'ORIG1',
      participant: '77@s.whatsapp.net',
      content: { type: 'text', text: 'alguém confirma?' }
    })
  })
})

describe('mapZapoContext', () => {
  it('returns empty object without message or context', () => {
    expect(mapZapoContext(null)).toEqual({})
    expect(mapZapoContext({ conversation: 'hi' })).toEqual({})
    expect(mapZapoContext({ extendedTextMessage: { text: 'hi' } })).toEqual({})
  })

  it('extracts mentions filtering falsy jids', () => {
    expect(
      mapZapoContext({
        extendedTextMessage: {
          text: 'hi',
          contextInfo: { mentionedJid: ['a@s.whatsapp.net', '', 'b@s.whatsapp.net'] }
        }
      })
    ).toEqual({ mentions: ['a@s.whatsapp.net', 'b@s.whatsapp.net'] })
  })

  it('reads context from media messages and unwraps wrappers', () => {
    expect(
      mapZapoContext({
        ephemeralMessage: {
          message: {
            imageMessage: { contextInfo: { stanzaId: 'Q1', participant: 'x@s.whatsapp.net' } }
          }
        }
      })
    ).toEqual({ quoted: { id: 'Q1', participant: 'x@s.whatsapp.net', content: undefined } })
  })

  it('drops quoted when there is no stanzaId', () => {
    expect(mapZapoContext({ extendedTextMessage: { contextInfo: { participant: 'x' } } })).toEqual(
      {}
    )
  })
})

describe('mapZapoReceipt', () => {
  const receipt = (over: Partial<WaIncomingReceiptEvent>): WaIncomingReceiptEvent => ({
    rawNode,
    status: 'read',
    fromSelfDevice: false,
    messageIds: ['M1'],
    chatJid: 'c@s.whatsapp.net',
    ...over
  })

  it('maps delivered/read/played and skips inactive', () => {
    expect(mapZapoReceipt(receipt({ status: 'delivered' }))?.status).toBe('delivered')
    expect(mapZapoReceipt(receipt({ status: 'read' }))?.status).toBe('read')
    expect(mapZapoReceipt(receipt({ status: 'played' }))?.status).toBe('played')
    expect(mapZapoReceipt(receipt({ status: 'inactive' }))).toBeNull()
  })

  it('marks group acks and carries participant', () => {
    const ack = mapZapoReceipt(
      receipt({ chatJid: '123@g.us', participantJid: 'u@s.whatsapp.net', messageIds: ['A', 'B'] })
    )
    expect(ack).toMatchObject({ isGroup: true, participant: 'u@s.whatsapp.net', ids: ['A', 'B'] })
  })
})

describe('mapZapoPresence', () => {
  it('maps available with timestamp last seen', () => {
    const event: WaIncomingPresenceEvent = {
      rawNode,
      type: 'available',
      chatJid: 'c@s.whatsapp.net',
      lastSeen: { kind: 'timestamp', unixSeconds: 123 }
    }
    expect(mapZapoPresence(event)).toEqual({
      type: 'presence',
      chat: 'c@s.whatsapp.net',
      status: 'available',
      lastSeen: 123
    })
  })

  it('maps unavailable with null last seen for non-timestamp sentinels', () => {
    const event: WaIncomingPresenceEvent = {
      rawNode,
      type: 'unavailable',
      chatJid: 'c@s.whatsapp.net',
      lastSeen: { kind: 'privacy_denied' }
    }
    expect(mapZapoPresence(event)).toMatchObject({ status: 'unavailable', lastSeen: null })
  })
})

describe('mapZapoChatstate', () => {
  const chatstate = (over: Partial<WaIncomingChatstateEvent>): WaIncomingChatstateEvent => ({
    rawNode,
    state: 'composing',
    chatJid: 'c@s.whatsapp.net',
    ...over
  })

  it('maps composing, recording (audio) and paused', () => {
    expect(mapZapoChatstate(chatstate({ state: 'composing' })).status).toBe('composing')
    expect(mapZapoChatstate(chatstate({ state: 'composing', media: 'audio' })).status).toBe(
      'recording'
    )
    expect(mapZapoChatstate(chatstate({ state: 'paused' })).status).toBe('paused')
  })
})
