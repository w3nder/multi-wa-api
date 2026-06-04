import type { GroupMetadata as BaileysGroupMetadata } from 'baileys'
import { describe, expect, it } from 'vitest'
import { mapBaileysMetadata } from './groups'

describe('mapBaileysMetadata', () => {
  it('normalizes baileys group metadata', () => {
    const meta = {
      id: '120363047212563241@g.us',
      subject: 'My group',
      owner: '5561@s.whatsapp.net',
      desc: 'a description',
      creation: 1700000000,
      announce: true,
      restrict: false,
      size: 2,
      participants: [
        { id: '5561@s.whatsapp.net', admin: 'superadmin' },
        { id: '5562@s.whatsapp.net', admin: null }
      ]
    } as unknown as BaileysGroupMetadata

    const result = mapBaileysMetadata(meta)
    expect(result).toEqual({
      id: '120363047212563241@g.us',
      subject: 'My group',
      owner: '5561@s.whatsapp.net',
      description: 'a description',
      createdAt: 1700000000,
      announce: true,
      restrict: false,
      size: 2,
      participants: [
        { id: '5561@s.whatsapp.net', admin: 'superadmin' },
        { id: '5562@s.whatsapp.net', admin: null }
      ]
    })
  })
})
