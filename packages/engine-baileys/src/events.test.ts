import { describe, expect, it } from 'vitest'
import {
  mapBaileysAck,
  mapBaileysAckStatus,
  mapBaileysContent,
  mapBaileysMessageEvent,
  mapBaileysPresence,
  mapBaileysReceipt
} from './events'

describe('mapBaileysContent', () => {
  it('maps plain text', () => {
    expect(mapBaileysContent({ conversation: 'hi' })).toEqual({ type: 'text', text: 'hi' })
  })

  it('maps extended text', () => {
    expect(mapBaileysContent({ extendedTextMessage: { text: 'link' } })).toEqual({
      type: 'text',
      text: 'link'
    })
  })

  it('maps image with caption and media metadata', () => {
    expect(
      mapBaileysContent({
        imageMessage: {
          mimetype: 'image/jpeg',
          fileLength: 1234,
          width: 600,
          height: 480,
          caption: 'a'
        }
      })
    ).toEqual({
      type: 'image',
      media: { mimetype: 'image/jpeg', size: 1234, width: 600, height: 480, seconds: undefined },
      caption: 'a'
    })
  })

  it('maps voice audio (ptt)', () => {
    expect(mapBaileysContent({ audioMessage: { mimetype: 'audio/ogg', ptt: true } })).toMatchObject(
      {
        type: 'audio',
        voice: true
      }
    )
  })

  it('maps location', () => {
    expect(
      mapBaileysContent({ locationMessage: { degreesLatitude: -23.5, degreesLongitude: -46.6 } })
    ).toMatchObject({ type: 'location', latitude: -23.5, longitude: -46.6 })
  })

  it('maps reaction', () => {
    expect(
      mapBaileysContent({ reactionMessage: { text: '❤️', key: { id: 'X', fromMe: true } } })
    ).toEqual({
      type: 'reaction',
      emoji: '❤️',
      target: { id: 'X', fromMe: true, participant: undefined }
    })
  })

  it('maps poll', () => {
    expect(
      mapBaileysContent({
        pollCreationMessage: { name: 'Q?', options: [{ optionName: 'A' }, { optionName: 'B' }] }
      })
    ).toMatchObject({ type: 'poll', question: 'Q?', options: ['A', 'B'] })
  })

  it('unwraps ephemeral wrappers', () => {
    expect(
      mapBaileysContent({ ephemeralMessage: { message: { conversation: 'secret' } } })
    ).toEqual({
      type: 'text',
      text: 'secret'
    })
  })

  it('falls back to unknown', () => {
    expect(mapBaileysContent({})).toEqual({ type: 'unknown' })
  })
})

describe('mapBaileysMessageEvent', () => {
  it('normalizes a group message', () => {
    const event = mapBaileysMessageEvent({
      key: { remoteJid: '123@g.us', id: 'M1', fromMe: false, participant: '55@s.whatsapp.net' },
      pushName: 'Ana',
      messageTimestamp: 1730000000,
      message: { conversation: 'oi' }
    })
    expect(event).toEqual({
      type: 'message',
      id: 'M1',
      chat: '123@g.us',
      from: '55@s.whatsapp.net',
      fromMe: false,
      isGroup: true,
      participant: '55@s.whatsapp.net',
      pushName: 'Ana',
      timestamp: 1730000000,
      content: { type: 'text', text: 'oi' }
    })
  })
})

describe('mapBaileysAckStatus', () => {
  it('maps numeric proto statuses', () => {
    expect(mapBaileysAckStatus(2)).toBe('sent')
    expect(mapBaileysAckStatus(3)).toBe('delivered')
    expect(mapBaileysAckStatus(4)).toBe('read')
    expect(mapBaileysAckStatus(5)).toBe('played')
    expect(mapBaileysAckStatus(0)).toBe('error')
  })
})

describe('mapBaileysAck', () => {
  it('builds an ack event', () => {
    expect(
      mapBaileysAck({
        key: { remoteJid: 'c@s.whatsapp.net', id: 'M1', fromMe: true },
        update: { status: 4 }
      })
    ).toEqual({
      type: 'ack',
      ids: ['M1'],
      chat: 'c@s.whatsapp.net',
      fromMe: true,
      isGroup: false,
      participant: undefined,
      status: 'read'
    })
  })

  it('returns null without status', () => {
    expect(mapBaileysAck({ key: { id: 'M1' }, update: {} })).toBeNull()
  })
})

describe('mapBaileysReceipt', () => {
  it('prefers played over read over delivered', () => {
    expect(
      mapBaileysReceipt({
        key: { remoteJid: 'c@s.whatsapp.net', id: 'M1' },
        receipt: { userJid: 'u@s.whatsapp.net', readTimestamp: 10, receiptTimestamp: 5 }
      })
    ).toMatchObject({ type: 'ack', status: 'read', participant: 'u@s.whatsapp.net' })
  })

  it('returns null without timestamps', () => {
    expect(mapBaileysReceipt({ key: { id: 'M1' }, receipt: {} })).toBeNull()
  })
})

describe('mapBaileysPresence', () => {
  it('maps presence map to per-participant events', () => {
    expect(
      mapBaileysPresence({
        id: 'c@s.whatsapp.net',
        presences: { 'u@s.whatsapp.net': { lastKnownPresence: 'composing' } }
      })
    ).toEqual([
      {
        type: 'presence',
        chat: 'c@s.whatsapp.net',
        from: 'u@s.whatsapp.net',
        status: 'composing',
        lastSeen: null
      }
    ])
  })
})
