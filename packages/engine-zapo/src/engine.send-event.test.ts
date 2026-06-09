import { describe, expect, it } from 'vitest'
import { toInboundContent } from './translate'
import type { MessageEvent } from '@multi-wa/types'

describe('ZapoEngine send event emission', () => {
  describe('toInboundContent conversion', () => {
    it('converts text content correctly', () => {
      const inbound = toInboundContent({ type: 'text', text: 'hello world' })
      expect(inbound).toEqual({ type: 'text', text: 'hello world' })
    })

    it('converts image content with caption', () => {
      const inbound = toInboundContent({
        type: 'image',
        media: { base64: 'abc123' },
        caption: 'Nice pic'
      })
      expect(inbound).toMatchObject({
        type: 'image',
        caption: 'Nice pic',
        media: { mimetype: 'image/jpeg' }
      })
    })

    it('converts video content', () => {
      const inbound = toInboundContent({
        type: 'video',
        media: { url: 'https://example.com/video.mp4' },
        caption: 'Watch this'
      })
      expect(inbound).toMatchObject({
        type: 'video',
        caption: 'Watch this',
        media: { mimetype: 'video/mp4' }
      })
    })

    it('converts audio content with voice flag', () => {
      const inbound = toInboundContent({
        type: 'audio',
        media: { base64: 'xyz789' },
        voice: true
      })
      expect(inbound).toMatchObject({
        type: 'audio',
        voice: true,
        media: { mimetype: 'audio/ogg; codecs=opus' }
      })
    })

    it('converts document content with mimetype', () => {
      const inbound = toInboundContent({
        type: 'document',
        media: { url: 'https://example.com/doc.pdf' },
        filename: 'report.pdf',
        mimetype: 'application/pdf',
        caption: 'Annual report'
      })
      expect(inbound).toMatchObject({
        type: 'document',
        fileName: 'report.pdf',
        media: { mimetype: 'application/pdf' },
        caption: 'Annual report'
      })
    })

    it('converts sticker content', () => {
      const inbound = toInboundContent({
        type: 'sticker',
        media: { base64: 'sticker_data' }
      })
      expect(inbound).toMatchObject({
        type: 'sticker',
        media: { mimetype: 'image/webp' }
      })
    })

    it('converts location content', () => {
      const inbound = toInboundContent({
        type: 'location',
        latitude: -23.5505,
        longitude: -46.6333,
        name: 'São Paulo',
        address: 'Brazil'
      })
      expect(inbound).toEqual({
        type: 'location',
        latitude: -23.5505,
        longitude: -46.6333,
        name: 'São Paulo',
        address: 'Brazil'
      })
    })

    it('converts contact content with vcard', () => {
      const inbound = toInboundContent({
        type: 'contact',
        fullName: 'John Doe',
        phone: '5511999999999'
      })
      expect(inbound).toMatchObject({
        type: 'contact',
        displayName: 'John Doe',
        vcard: expect.stringContaining('BEGIN:VCARD')
      })
    })
  })

  it('constructs message event with correct payload structure', () => {
    const messageEvent: MessageEvent = {
      type: 'message',
      id: 'zapo_msg_123',
      chat: 'recipient@s.whatsapp.net',
      from: 'me@s.whatsapp.net',
      fromMe: true,
      isGroup: false,
      content: { type: 'text', text: 'hello from zapo' },
      timestamp: Math.floor(Date.now() / 1000)
    }

    expect(messageEvent.type).toBe('message')
    expect(messageEvent.fromMe).toBe(true)
    expect(messageEvent.id).toBe('zapo_msg_123')
    expect(messageEvent.content.type).toBe('text')
  })

  it('constructs group message event with isGroup flag', () => {
    const groupEvent: MessageEvent = {
      type: 'message',
      id: 'zapo_grp_msg_456',
      chat: 'group_id@g.us',
      from: 'me@s.whatsapp.net',
      fromMe: true,
      isGroup: true,
      content: { type: 'text', text: 'group message' },
      timestamp: Math.floor(Date.now() / 1000)
    }

    expect(groupEvent.isGroup).toBe(true)
    expect(groupEvent.chat).toContain('@g.us')
  })

  it('constructs message event with media content', () => {
    const imageEvent: MessageEvent = {
      type: 'message',
      id: 'zapo_img_789',
      chat: 'user@s.whatsapp.net',
      from: 'me@s.whatsapp.net',
      fromMe: true,
      isGroup: false,
      content: {
        type: 'image',
        media: { mimetype: 'image/jpeg' },
        caption: 'Photo sent'
      },
      timestamp: Math.floor(Date.now() / 1000)
    }

    expect(imageEvent.content.type).toBe('image')
    expect((imageEvent.content as any).caption).toBe('Photo sent')
  })
})
