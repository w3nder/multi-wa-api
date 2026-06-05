import { describe, expect, it } from 'vitest'
import {
  createApiKeyInputSchema,
  createGroupInputSchema,
  createSessionInputSchema,
  createWebhookInputSchema,
  engineEventSchema,
  groupSettingSchema,
  loginInputSchema,
  messageContentSchema,
  migrateSessionInputSchema,
  sendMessageInputSchema,
  updateParticipantsInputSchema
} from './index'

describe('message schemas', () => {
  it('accepts a text content', () => {
    expect(messageContentSchema.safeParse({ type: 'text', text: 'hi' }).success).toBe(true)
  })

  it('rejects an unknown content kind', () => {
    expect(messageContentSchema.safeParse({ type: 'unknown' }).success).toBe(false)
  })

  it('requires media for image content', () => {
    expect(messageContentSchema.safeParse({ type: 'image' }).success).toBe(false)
    expect(
      messageContentSchema.safeParse({ type: 'image', media: { url: 'https://x/y.jpg' } }).success
    ).toBe(true)
  })

  it('accepts base64 media', () => {
    expect(
      messageContentSchema.safeParse({ type: 'image', media: { base64: 'aGk=' } }).success
    ).toBe(true)
  })

  it('validates location numbers', () => {
    expect(
      messageContentSchema.safeParse({ type: 'location', latitude: 1, longitude: 2 }).success
    ).toBe(true)
    expect(
      messageContentSchema.safeParse({ type: 'location', latitude: 'x', longitude: 2 }).success
    ).toBe(false)
  })

  it('validates a full send message input', () => {
    expect(
      sendMessageInputSchema.safeParse({
        to: '5511999999999',
        content: { type: 'text', text: 'hello' }
      }).success
    ).toBe(true)
  })
})

describe('session schemas', () => {
  it('validates the engine enum', () => {
    expect(createSessionInputSchema.safeParse({ name: 'a', engine: 'zapo' }).success).toBe(true)
    expect(createSessionInputSchema.safeParse({ name: 'a', engine: 'nope' }).success).toBe(false)
  })

  it('validates migration target', () => {
    expect(migrateSessionInputSchema.safeParse({ to: 'baileys' }).success).toBe(true)
    expect(migrateSessionInputSchema.safeParse({ to: 'sms' }).success).toBe(false)
  })
})

describe('auth and webhook schemas', () => {
  it('validates login input', () => {
    expect(loginInputSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
    expect(loginInputSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
  })

  it('validates api key name', () => {
    expect(createApiKeyInputSchema.safeParse({ name: 'ci' }).success).toBe(true)
    expect(createApiKeyInputSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('requires a url and at least one event for webhooks', () => {
    expect(
      createWebhookInputSchema.safeParse({ url: 'https://x/hook', events: ['message'] }).success
    ).toBe(true)
    expect(createWebhookInputSchema.safeParse({ url: 'x', events: ['message'] }).success).toBe(
      false
    )
    expect(createWebhookInputSchema.safeParse({ url: 'https://x/hook', events: [] }).success).toBe(
      false
    )
  })
})

describe('group schemas', () => {
  it('validates create group input', () => {
    expect(createGroupInputSchema.safeParse({ subject: 'g', participants: ['5511'] }).success).toBe(
      true
    )
    expect(createGroupInputSchema.safeParse({ subject: '' }).success).toBe(false)
  })

  it('validates participant action enum and non-empty list', () => {
    expect(
      updateParticipantsInputSchema.safeParse({ action: 'add', participants: ['5511'] }).success
    ).toBe(true)
    expect(
      updateParticipantsInputSchema.safeParse({ action: 'banana', participants: ['5511'] }).success
    ).toBe(false)
    expect(
      updateParticipantsInputSchema.safeParse({ action: 'add', participants: [] }).success
    ).toBe(false)
  })

  it('validates the group setting enum', () => {
    for (const setting of ['announcement', 'not_announcement', 'locked', 'unlocked']) {
      expect(groupSettingSchema.safeParse(setting).success).toBe(true)
    }
    expect(groupSettingSchema.safeParse('open').success).toBe(false)
  })
})

describe('engine event schema', () => {
  it('parses qr, connection, message, ack and presence events', () => {
    expect(engineEventSchema.safeParse({ type: 'qr', qr: 'abc' }).success).toBe(true)
    expect(engineEventSchema.safeParse({ type: 'connection', status: 'connected' }).success).toBe(
      true
    )
    expect(
      engineEventSchema.safeParse({
        type: 'message',
        chat: 'c',
        from: 'f',
        fromMe: false,
        isGroup: false,
        content: { type: 'text', text: 'hi' }
      }).success
    ).toBe(true)
    expect(
      engineEventSchema.safeParse({
        type: 'ack',
        ids: ['1'],
        chat: 'c',
        isGroup: false,
        status: 'read'
      }).success
    ).toBe(true)
    expect(
      engineEventSchema.safeParse({ type: 'presence', chat: 'c', status: 'composing' }).success
    ).toBe(true)
    expect(engineEventSchema.safeParse({ type: 'connection', status: 'bogus' }).success).toBe(false)
  })
})

describe('issue #7 event schemas', () => {
  it('parses a call event', () => {
    expect(
      engineEventSchema.safeParse({ type: 'call', status: 'offer', from: 'u@s.whatsapp.net', isGroup: false })
        .success
    ).toBe(true)
    expect(
      engineEventSchema.safeParse({ type: 'call', status: 'missed', from: 'u', isGroup: false }).success
    ).toBe(false)
  })

  it('parses a group_participants event', () => {
    expect(
      engineEventSchema.safeParse({
        type: 'group_participants',
        chat: 'g@g.us',
        action: 'add',
        participants: ['a@s.whatsapp.net']
      }).success
    ).toBe(true)
    expect(
      engineEventSchema.safeParse({
        type: 'group_participants',
        chat: 'g@g.us',
        action: 'modify',
        participants: []
      }).success
    ).toBe(false)
  })

  it('parses a partial group_update event', () => {
    expect(engineEventSchema.safeParse({ type: 'group_update', chat: 'g@g.us', subject: 'New' }).success).toBe(
      true
    )
    expect(engineEventSchema.safeParse({ type: 'group_update', chat: 'g@g.us', announce: true }).success).toBe(
      true
    )
  })

  it('parses a membership_request event', () => {
    expect(
      engineEventSchema.safeParse({
        type: 'membership_request',
        chat: 'g@g.us',
        action: 'created',
        participant: 'a@s.whatsapp.net'
      }).success
    ).toBe(true)
    expect(
      engineEventSchema.safeParse({
        type: 'membership_request',
        chat: 'g@g.us',
        action: 'approved',
        participant: 'a'
      }).success
    ).toBe(false)
  })

  it('accepts the new webhook event types', () => {
    for (const event of ['call', 'group_participants', 'group_update', 'membership_request']) {
      expect(createWebhookInputSchema.safeParse({ url: 'https://x/hook', events: [event] }).success).toBe(true)
    }
  })

  it('retains lid<->pn alternate fields through parsing', () => {
    const call = engineEventSchema.parse({
      type: 'call',
      status: 'offer',
      from: '99@lid',
      fromAlt: '5511888888888@s.whatsapp.net',
      isGroup: false
    })
    expect(call).toMatchObject({ type: 'call', fromAlt: '5511888888888@s.whatsapp.net' })

    const participants = engineEventSchema.parse({
      type: 'group_participants',
      chat: 'g@g.us',
      action: 'add',
      participants: ['a@lid'],
      authorAlt: '5511999999999@s.whatsapp.net'
    })
    expect(participants).toMatchObject({
      type: 'group_participants',
      authorAlt: '5511999999999@s.whatsapp.net'
    })

    const membership = engineEventSchema.parse({
      type: 'membership_request',
      chat: 'g@g.us',
      action: 'created',
      participant: 'a@lid',
      participantAlt: '5511888888888@s.whatsapp.net',
      authorAlt: '5511999999999@s.whatsapp.net'
    })
    expect(membership).toMatchObject({
      type: 'membership_request',
      participantAlt: '5511888888888@s.whatsapp.net',
      authorAlt: '5511999999999@s.whatsapp.net'
    })
  })
})
