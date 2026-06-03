import { describe, expect, it } from 'vitest'
import { createSessionInputSchema, messageContentSchema, sendMessageInputSchema } from './index'

describe('schemas', () => {
  it('accepts a text content', () => {
    expect(messageContentSchema.safeParse({ kind: 'text', text: 'hi' }).success).toBe(true)
  })

  it('rejects an unknown content kind', () => {
    expect(messageContentSchema.safeParse({ kind: 'unknown' }).success).toBe(false)
  })

  it('requires media for image content', () => {
    expect(messageContentSchema.safeParse({ kind: 'image' }).success).toBe(false)
    expect(
      messageContentSchema.safeParse({ kind: 'image', media: { url: 'https://x/y.jpg' } }).success
    ).toBe(true)
  })

  it('validates the session engine enum', () => {
    expect(createSessionInputSchema.safeParse({ name: 'a', engine: 'zapo' }).success).toBe(true)
    expect(createSessionInputSchema.safeParse({ name: 'a', engine: 'nope' }).success).toBe(false)
  })

  it('validates a full send message input', () => {
    const result = sendMessageInputSchema.safeParse({
      to: '5511999999999',
      content: { kind: 'text', text: 'hello' }
    })
    expect(result.success).toBe(true)
  })
})
