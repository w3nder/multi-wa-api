import type { WAMessageKey } from 'baileys'
import { describe, expect, it } from 'vitest'
import {
  isBaileysReactionUpsert,
  mapBaileysAck,
  mapBaileysAckStatus,
  mapBaileysContent,
  mapBaileysContext,
  mapBaileysMessageEvent,
  mapBaileysPresence,
  mapBaileysReaction,
  mapBaileysReceipt
} from './events'

describe('mapBaileysContent', () => {
  it('maps text variants', () => {
    expect(mapBaileysContent({ conversation: 'hi' })).toEqual({ type: 'text', text: 'hi' })
    expect(mapBaileysContent({ extendedTextMessage: { text: 'link' } })).toEqual({
      type: 'text',
      text: 'link'
    })
    expect(mapBaileysContent({ extendedTextMessage: {} })).toEqual({ type: 'text', text: '' })
  })

  it('maps image with and without caption', () => {
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
    expect(mapBaileysContent({ imageMessage: {} })).toMatchObject({
      type: 'image',
      caption: undefined
    })
  })

  it('maps video plain, gif and ptv', () => {
    expect(mapBaileysContent({ videoMessage: { caption: 'v', gifPlayback: true } })).toMatchObject({
      type: 'video',
      caption: 'v',
      gif: true
    })
    expect(mapBaileysContent({ ptvMessage: { mimetype: 'video/mp4' } })).toMatchObject({
      type: 'video'
    })
  })

  it('maps audio voice and non-voice', () => {
    expect(mapBaileysContent({ audioMessage: { ptt: true } })).toMatchObject({
      type: 'audio',
      voice: true
    })
    expect(mapBaileysContent({ audioMessage: {} })).toMatchObject({
      type: 'audio',
      voice: undefined
    })
  })

  it('maps document', () => {
    expect(
      mapBaileysContent({
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
    expect(mapBaileysContent({ stickerMessage: { isAnimated: true } })).toMatchObject({
      type: 'sticker',
      animated: true
    })
  })

  it('maps location and live location', () => {
    expect(
      mapBaileysContent({
        locationMessage: { degreesLatitude: -23.5, degreesLongitude: -46.6, name: 'p' }
      })
    ).toMatchObject({ type: 'location', latitude: -23.5, longitude: -46.6, name: 'p' })
    expect(mapBaileysContent({ liveLocationMessage: {} })).toEqual({
      type: 'location',
      latitude: 0,
      longitude: 0
    })
  })

  it('maps contact', () => {
    expect(mapBaileysContent({ contactMessage: { displayName: 'J', vcard: 'V' } })).toEqual({
      type: 'contact',
      displayName: 'J',
      vcard: 'V'
    })
  })

  it('maps reaction with and without emoji', () => {
    expect(
      mapBaileysContent({ reactionMessage: { text: '❤️', key: { id: 'X', fromMe: true } } })
    ).toEqual({
      type: 'reaction',
      emoji: '❤️',
      target: { id: 'X', fromMe: true, participant: undefined }
    })
    expect(mapBaileysContent({ reactionMessage: { key: { id: 'Y' } } })).toMatchObject({
      type: 'reaction',
      emoji: null
    })
  })

  it('maps poll (v1 and v2)', () => {
    expect(
      mapBaileysContent({
        pollCreationMessage: { name: 'Q?', options: [{ optionName: 'A' }, { optionName: 'B' }] }
      })
    ).toMatchObject({ type: 'poll', question: 'Q?', options: ['A', 'B'] })
    expect(mapBaileysContent({ pollCreationMessageV2: { name: 'Q2', options: [] } })).toMatchObject(
      {
        type: 'poll',
        question: 'Q2'
      }
    )
  })

  it('maps button and list responses', () => {
    expect(
      mapBaileysContent({
        buttonsResponseMessage: { selectedButtonId: '1', selectedDisplayText: 'Ok' }
      })
    ).toEqual({
      type: 'buttons_response',
      id: '1',
      text: 'Ok'
    })
    expect(
      mapBaileysContent({
        listResponseMessage: { title: 'T', singleSelectReply: { selectedRowId: 'r' } }
      })
    ).toMatchObject({ type: 'list_response', rowId: 'r', title: 'T' })
  })

  it('unwraps every wrapper kind', () => {
    expect(
      mapBaileysContent({ ephemeralMessage: { message: { conversation: 'a' } } })
    ).toMatchObject({ type: 'text', text: 'a' })
    expect(
      mapBaileysContent({ viewOnceMessage: { message: { conversation: 'b' } } })
    ).toMatchObject({ type: 'text', text: 'b' })
    expect(
      mapBaileysContent({ viewOnceMessageV2: { message: { conversation: 'c' } } })
    ).toMatchObject({ type: 'text', text: 'c' })
    expect(
      mapBaileysContent({ viewOnceMessageV2Extension: { message: { conversation: 'd' } } })
    ).toMatchObject({ type: 'text', text: 'd' })
    expect(
      mapBaileysContent({ documentWithCaptionMessage: { message: { conversation: 'e' } } })
    ).toMatchObject({ type: 'text', text: 'e' })
    expect(mapBaileysContent({ editedMessage: { message: { conversation: 'f' } } })).toMatchObject({
      type: 'text',
      text: 'f'
    })
  })

  it('falls back to unknown for empty and nullish', () => {
    expect(mapBaileysContent({})).toEqual({ type: 'unknown' })
    expect(mapBaileysContent(null)).toEqual({ type: 'unknown' })
    expect(mapBaileysContent(undefined)).toEqual({ type: 'unknown' })
  })

  it('includes base64 download pointers in media', () => {
    const out = mapBaileysContent({
      imageMessage: {
        mediaKey: new Uint8Array([1, 2, 3]),
        directPath: '/v/x',
        url: 'https://cdn/x',
        fileEncSha256: new Uint8Array([4]),
        fileSha256: new Uint8Array([5])
      }
    })
    expect(out).toMatchObject({
      type: 'image',
      media: {
        directPath: '/v/x',
        url: 'https://cdn/x',
        mediaKey: Buffer.from([1, 2, 3]).toString('base64'),
        fileEncSha256: Buffer.from([4]).toString('base64'),
        fileSha256: Buffer.from([5]).toString('base64')
      }
    })
  })
})

describe('mapBaileysMessageEvent', () => {
  it('normalizes a direct message', () => {
    expect(
      mapBaileysMessageEvent({
        key: { remoteJid: 'c@s.whatsapp.net', id: 'M1', fromMe: true },
        pushName: 'Ana',
        messageTimestamp: 1730000000,
        message: { conversation: 'oi' }
      })
    ).toEqual({
      type: 'message',
      id: 'M1',
      chat: 'c@s.whatsapp.net',
      from: 'c@s.whatsapp.net',
      fromMe: true,
      isGroup: false,
      participant: undefined,
      pushName: 'Ana',
      timestamp: 1730000000,
      content: { type: 'text', text: 'oi' }
    })
  })

  it('uses participant as from in groups and tolerates missing fields', () => {
    const event = mapBaileysMessageEvent({
      key: { remoteJid: '123@g.us', id: 'M2', fromMe: false, participant: '55@s.whatsapp.net' }
    })
    expect(event.from).toBe('55@s.whatsapp.net')
    expect(event.isGroup).toBe(true)
    expect(event.content).toEqual({ type: 'unknown' })
  })

  it('exposes fromAlt (lid<->pn) from the key, omitting it when absent', () => {
    const lidGroup = mapBaileysMessageEvent({
      key: {
        remoteJid: '123@g.us',
        id: 'M4',
        participant: '199@lid',
        participantAlt: '55@s.whatsapp.net'
      },
      message: { conversation: 'oi' }
    })
    expect(lidGroup.from).toBe('199@lid')
    expect(lidGroup.fromAlt).toBe('55@s.whatsapp.net')

    const lidDirect = mapBaileysMessageEvent({
      key: { remoteJid: '199@lid', id: 'M5', remoteJidAlt: '55@s.whatsapp.net' },
      message: { conversation: 'oi' }
    })
    expect(lidDirect.fromAlt).toBe('55@s.whatsapp.net')

    const plain = mapBaileysMessageEvent({
      key: { remoteJid: 'c@s.whatsapp.net', id: 'M6' },
      message: { conversation: 'oi' }
    })
    expect(plain.fromAlt).toBeUndefined()
  })

  it('includes mentions and quoted when present, omits them otherwise', () => {
    const plain = mapBaileysMessageEvent({
      key: { remoteJid: 'c@s.whatsapp.net', id: 'M1' },
      message: { conversation: 'oi' }
    })
    expect(plain).not.toHaveProperty('mentions')
    expect(plain).not.toHaveProperty('quoted')

    const reply = mapBaileysMessageEvent({
      key: { remoteJid: '123@g.us', id: 'M3', participant: '55@s.whatsapp.net' },
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
    expect(reply.mentions).toEqual(['77@s.whatsapp.net'])
    expect(reply.quoted).toEqual({
      id: 'ORIG1',
      participant: '77@s.whatsapp.net',
      content: { type: 'text', text: 'alguém confirma?' }
    })
  })
})

describe('mapBaileysContext', () => {
  it('returns empty object without message or context', () => {
    expect(mapBaileysContext(null)).toEqual({})
    expect(mapBaileysContext({ conversation: 'hi' })).toEqual({})
    expect(mapBaileysContext({ extendedTextMessage: { text: 'hi' } })).toEqual({})
  })

  it('extracts mentions filtering falsy jids', () => {
    expect(
      mapBaileysContext({
        extendedTextMessage: {
          text: 'hi',
          contextInfo: { mentionedJid: ['a@s.whatsapp.net', '', 'b@s.whatsapp.net'] }
        }
      })
    ).toEqual({ mentions: ['a@s.whatsapp.net', 'b@s.whatsapp.net'] })
  })

  it('reads context from media messages and unwraps wrappers', () => {
    expect(
      mapBaileysContext({
        ephemeralMessage: {
          message: {
            imageMessage: { contextInfo: { stanzaId: 'Q1', participant: 'x@s.whatsapp.net' } }
          }
        }
      })
    ).toEqual({ quoted: { id: 'Q1', participant: 'x@s.whatsapp.net', content: undefined } })
  })

  it('drops quoted when there is no stanzaId', () => {
    expect(
      mapBaileysContext({ extendedTextMessage: { contextInfo: { participant: 'x' } } })
    ).toEqual({})
  })
})

describe('isBaileysReactionUpsert', () => {
  it('detects plain and encrypted reactions, ignores other content', () => {
    expect(isBaileysReactionUpsert({ key: {}, message: { reactionMessage: { text: '❤️' } } })).toBe(
      true
    )
    expect(isBaileysReactionUpsert({ key: {}, message: { encReactionMessage: {} } })).toBe(true)
    expect(isBaileysReactionUpsert({ key: {}, message: { conversation: 'oi' } })).toBe(false)
    expect(isBaileysReactionUpsert({ key: {} })).toBe(false)
  })
})

describe('mapBaileysReaction', () => {
  it('maps a group reaction, reproducing the upsert shape (envelope vs target)', () => {
    const envelope = {
      remoteJid: '123@g.us',
      id: 'REACT1',
      fromMe: false,
      participant: '55@lid',
      participantAlt: '55@s.whatsapp.net'
    } as WAMessageKey
    const event = mapBaileysReaction({
      key: { remoteJid: '123@g.us', id: 'TARGET1', fromMe: true, participant: '99@s.whatsapp.net' },
      reaction: { text: '❤️', senderTimestampMs: 1730000000000, key: envelope }
    })
    expect(event).toEqual({
      type: 'message',
      id: 'REACT1',
      chat: '123@g.us',
      from: '55@lid',
      fromMe: false,
      isGroup: true,
      participant: '55@lid',
      fromAlt: '55@s.whatsapp.net',
      timestamp: 1730000000,
      content: {
        type: 'reaction',
        emoji: '❤️',
        target: { id: 'TARGET1', fromMe: true, participant: '99@s.whatsapp.net' }
      }
    })
  })

  it('maps a reaction removal (no text) to a null emoji', () => {
    const event = mapBaileysReaction({
      key: { remoteJid: 'c@s.whatsapp.net', id: 'T2' },
      reaction: { key: { remoteJid: 'c@s.whatsapp.net', id: 'R2', fromMe: true } }
    })
    expect(event.fromMe).toBe(true)
    expect(event.content).toEqual({
      type: 'reaction',
      emoji: null,
      target: { id: 'T2', fromMe: undefined, participant: undefined }
    })
  })
})

describe('mapBaileysAckStatus', () => {
  it('maps every numeric proto status', () => {
    expect(mapBaileysAckStatus(0)).toBe('error')
    expect(mapBaileysAckStatus(1)).toBe('pending')
    expect(mapBaileysAckStatus(2)).toBe('sent')
    expect(mapBaileysAckStatus(3)).toBe('delivered')
    expect(mapBaileysAckStatus(4)).toBe('read')
    expect(mapBaileysAckStatus(5)).toBe('played')
    expect(mapBaileysAckStatus(99)).toBe('pending')
  })
})

describe('mapBaileysAck', () => {
  it('builds a direct ack', () => {
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

  it('builds a group ack and handles missing id', () => {
    expect(
      mapBaileysAck({
        key: { remoteJid: '1@g.us', participant: 'u@s.whatsapp.net' },
        update: { status: 3 }
      })
    ).toMatchObject({
      isGroup: true,
      ids: [],
      participant: 'u@s.whatsapp.net',
      status: 'delivered'
    })
  })

  it('returns null when status is missing', () => {
    expect(mapBaileysAck({ key: { id: 'M1' }, update: {} })).toBeNull()
    expect(mapBaileysAck({ key: { id: 'M1' }, update: { status: null } })).toBeNull()
  })
})

describe('mapBaileysReceipt', () => {
  it('prefers played over read over delivered', () => {
    expect(
      mapBaileysReceipt({
        key: { remoteJid: 'c@s', id: 'M1' },
        receipt: { playedTimestamp: 3, readTimestamp: 2, receiptTimestamp: 1 }
      })
    ).toMatchObject({ status: 'played' })
    expect(
      mapBaileysReceipt({
        key: { remoteJid: 'c@s', id: 'M1' },
        receipt: { readTimestamp: 2, receiptTimestamp: 1 }
      })
    ).toMatchObject({ status: 'read' })
    expect(
      mapBaileysReceipt({ key: { remoteJid: 'c@s', id: 'M1' }, receipt: { receiptTimestamp: 1 } })
    ).toMatchObject({ status: 'delivered' })
  })

  it('uses receipt userJid as participant and falls back to key participant', () => {
    expect(
      mapBaileysReceipt({
        key: { remoteJid: '1@g.us', id: 'M1', participant: 'k@s' },
        receipt: { userJid: 'u@s', readTimestamp: 5 }
      })
    ).toMatchObject({ participant: 'u@s', isGroup: true })
    expect(
      mapBaileysReceipt({
        key: { remoteJid: '1@g.us', id: 'M1', participant: 'k@s' },
        receipt: { readTimestamp: 5 }
      })
    ).toMatchObject({ participant: 'k@s' })
  })

  it('returns null without timestamps', () => {
    expect(mapBaileysReceipt({ key: { id: 'M1' }, receipt: {} })).toBeNull()
  })
})

describe('mapBaileysPresence', () => {
  it('maps presence map to per-participant events with status fallback', () => {
    expect(
      mapBaileysPresence({
        id: 'c@s.whatsapp.net',
        presences: {
          'a@s': { lastKnownPresence: 'composing' },
          'b@s': { lastKnownPresence: 'available', lastSeen: 99 },
          'c@s': { lastKnownPresence: 'recording' },
          'd@s': { lastKnownPresence: 'paused' },
          'e@s': {}
        }
      })
    ).toEqual([
      {
        type: 'presence',
        chat: 'c@s.whatsapp.net',
        from: 'a@s',
        status: 'composing',
        lastSeen: null
      },
      {
        type: 'presence',
        chat: 'c@s.whatsapp.net',
        from: 'b@s',
        status: 'available',
        lastSeen: 99
      },
      {
        type: 'presence',
        chat: 'c@s.whatsapp.net',
        from: 'c@s',
        status: 'recording',
        lastSeen: null
      },
      { type: 'presence', chat: 'c@s.whatsapp.net', from: 'd@s', status: 'paused', lastSeen: null },
      {
        type: 'presence',
        chat: 'c@s.whatsapp.net',
        from: 'e@s',
        status: 'unavailable',
        lastSeen: null
      }
    ])
  })

  it('handles an empty presences map', () => {
    expect(mapBaileysPresence({ id: 'c@s' })).toEqual([])
  })
})
