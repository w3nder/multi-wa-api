import { describe, expect, it } from 'vitest'
import { toUserJid } from './jid'

describe('toUserJid', () => {
  it('appends the user domain to a plain number', () => {
    expect(toUserJid('556195514650')).toBe('556195514650@s.whatsapp.net')
  })

  it('keeps an existing jid untouched', () => {
    expect(toUserJid('120363047212563241@g.us')).toBe('120363047212563241@g.us')
  })

  it('strips non-digits from numbers', () => {
    expect(toUserJid('+55 (61) 99551-4650')).toBe('5561995514650@s.whatsapp.net')
  })
})
