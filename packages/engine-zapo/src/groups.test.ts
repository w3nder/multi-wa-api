import { describe, expect, it } from 'vitest'
import { mapZapoInviteInfo, mapZapoMetadata } from './groups'

describe('mapZapoMetadata', () => {
  it('normalizes zapo group metadata (jid/role mapping)', () => {
    const meta = {
      jid: '120363047212563241@g.us',
      subject: 'My group',
      owner: '5561@s.whatsapp.net',
      desc: 'a description',
      creation: 1700000000,
      announce: false,
      restrict: true,
      size: 2,
      participants: [
        { jid: '5561@s.whatsapp.net', isAdmin: true, isSuperAdmin: true },
        { jid: '5562@s.whatsapp.net', isAdmin: false, isSuperAdmin: false }
      ]
    }

    const result = mapZapoMetadata(meta as never)
    expect(result.id).toBe('120363047212563241@g.us')
    expect(result.restrict).toBe(true)
    expect(result.participants).toEqual([
      { id: '5561@s.whatsapp.net', admin: 'superadmin' },
      { id: '5562@s.whatsapp.net', admin: null }
    ])
  })
})

describe('mapZapoInviteInfo', () => {
  it('normalizes the lighter invite preview shape', () => {
    const info = {
      jid: '120363047212563241@g.us',
      subject: 'Preview',
      size: 1,
      participants: [{ jid: '5561@s.whatsapp.net' }]
    }
    const result = mapZapoInviteInfo(info as never)
    expect(result.id).toBe('120363047212563241@g.us')
    expect(result.announce).toBe(false)
    expect(result.participants).toEqual([{ id: '5561@s.whatsapp.net', admin: null }])
  })
})
