import { describe, expect, it } from 'vitest'
import { downloadMediaInputSchema, mediaStorageModeSchema } from './media'

describe('media schemas', () => {
  it('accepts a download media input', () => {
    expect(
      downloadMediaInputSchema.safeParse({
        type: 'image',
        media: { mimetype: 'image/jpeg', mediaKey: 'a', directPath: '/v/x' }
      }).success
    ).toBe(true)
  })

  it('rejects an unknown media type', () => {
    expect(downloadMediaInputSchema.safeParse({ type: 'gif', media: {} }).success).toBe(false)
  })

  it('requires type and media', () => {
    expect(downloadMediaInputSchema.safeParse({ media: {} }).success).toBe(false)
    expect(downloadMediaInputSchema.safeParse({ type: 'image' }).success).toBe(false)
  })

  it('validates media storage mode', () => {
    for (const mode of ['default', 'none', 's3']) {
      expect(mediaStorageModeSchema.safeParse(mode).success).toBe(true)
    }
    expect(mediaStorageModeSchema.safeParse('ftp').success).toBe(false)
  })
})
