import { describe, expect, it } from 'vitest'
import {
  constantTimeEqual,
  hashPassword,
  hmacSign,
  randomToken,
  sha256,
  verifyPassword
} from './crypto'

describe('crypto', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('s3cret')
    expect(await verifyPassword(hash, 's3cret')).toBe(true)
    expect(await verifyPassword(hash, 'wrong')).toBe(false)
  })

  it('produces deterministic sha256', () => {
    expect(sha256('a')).toBe(sha256('a'))
    expect(sha256('a')).not.toBe(sha256('b'))
  })

  it('compares in constant time', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })

  it('signs hmac deterministically', () => {
    expect(hmacSign('key', 'msg')).toBe(hmacSign('key', 'msg'))
    expect(hmacSign('key', 'msg')).not.toBe(hmacSign('other', 'msg'))
  })

  it('generates unique tokens', () => {
    expect(randomToken()).not.toBe(randomToken())
  })
})
