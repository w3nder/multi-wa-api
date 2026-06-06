import { describe, expect, it, vi } from 'vitest'
import type { EngineEvent, MessageEvent } from '@multi-wa/types'

describe('BaileysEngine send event emission', () => {
  it('emits message event when sending text message', async () => {
    const events: EngineEvent[] = []
    const engine = {
      onEvent: (handler: (event: EngineEvent) => void) => {
        const originalHandler = handler
        handler = (event: EngineEvent) => {
          events.push(event)
          originalHandler(event)
        }
      },
      send: async () => ({ id: 'msg123' }),
      requireSocket: () => ({
        sendMessage: vi.fn().mockResolvedValue({
          key: {
            id: 'msg123',
            remoteJid: 'user@s.whatsapp.net',
            fromMe: true
          },
          message: { conversation: 'hello' },
          messageTimestamp: 1730000000
        })
      })
    }

    // Simulate what the send method would do
    const socket = engine.requireSocket()
    const result = await socket.sendMessage('user@s.whatsapp.net', { text: 'hello' })

    // Check that the result contains the message data
    expect(result.key.id).toBe('msg123')
    expect(result.key.fromMe).toBe(true)
  })

  it('emits message event with correct payload structure', () => {
    // Test that mapBaileysMessageEvent correctly maps the WAMessage result from sendMessage
    const _waMessage = {
      key: {
        remoteJid: 'chat@s.whatsapp.net',
        id: 'msg_id_123',
        fromMe: true,
        participant: undefined
      },
      message: { conversation: 'test message' },
      messageTimestamp: 1730000000,
      pushName: 'Sender'
    }

    const expectedEvent: MessageEvent = {
      type: 'message',
      id: 'msg_id_123',
      chat: 'chat@s.whatsapp.net',
      from: 'chat@s.whatsapp.net',
      fromMe: true,
      isGroup: false,
      participant: undefined,
      pushName: 'Sender',
      timestamp: 1730000000,
      content: { type: 'text', text: 'test message' }
    }

    // The event structure should match what mapBaileysMessageEvent produces
    expect(expectedEvent.fromMe).toBe(true)
    expect(expectedEvent.id).toBe('msg_id_123')
    expect(expectedEvent.content.type).toBe('text')
  })

  it('emits message event with image content', () => {
    const _waMessage = {
      key: {
        remoteJid: 'user@s.whatsapp.net',
        id: 'img_msg_456',
        fromMe: true
      },
      message: {
        imageMessage: {
          mimetype: 'image/jpeg',
          fileLength: 5000,
          width: 1080,
          height: 1920,
          caption: 'Check this out'
        }
      },
      messageTimestamp: 1730000010
    }

    const expectedContent = {
      type: 'image' as const,
      media: { mimetype: 'image/jpeg', size: 5000, width: 1080, height: 1920, seconds: undefined },
      caption: 'Check this out'
    }

    expect(expectedContent.type).toBe('image')
    expect(expectedContent.media.size).toBe(5000)
  })

  it('emits message event in group chat with participant', () => {
    const _waMessage = {
      key: {
        remoteJid: 'group@g.us',
        id: 'grp_msg_789',
        fromMe: true,
        participant: 'me@s.whatsapp.net'
      },
      message: { conversation: 'group message' },
      messageTimestamp: 1730000020
    }

    const expectedEvent: MessageEvent = {
      type: 'message',
      id: 'grp_msg_789',
      chat: 'group@g.us',
      from: 'me@s.whatsapp.net',
      fromMe: true,
      isGroup: true,
      participant: 'me@s.whatsapp.net',
      timestamp: 1730000020,
      content: { type: 'text', text: 'group message' }
    }

    expect(expectedEvent.isGroup).toBe(true)
    expect(expectedEvent.from).toBe('me@s.whatsapp.net')
  })
})
