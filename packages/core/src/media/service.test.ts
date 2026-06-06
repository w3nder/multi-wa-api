import { Readable } from 'node:stream'
import type { EngineEvent } from '@multi-wa/types'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { WaEngine } from '../engine/types'
import { AppError } from '../lib/errors'
import type { Logger } from '../lib/logger'
import type { SessionManager } from '../sessions/manager'
import type { TenantRepository } from '../tenants/repository'
import { MediaService } from './service'
import type { MediaStorage } from './storage'

const logger = pino({ level: 'silent' }) as unknown as Logger

function imageEvent(): EngineEvent {
  return {
    type: 'message',
    id: 'M1',
    chat: 'c@s.whatsapp.net',
    from: 'c@s.whatsapp.net',
    fromMe: false,
    isGroup: false,
    timestamp: 1730000000,
    content: {
      type: 'image',
      media: { mimetype: 'image/jpeg', size: 5, mediaKey: 'KEY', directPath: '/v/x', url: 'enc' }
    }
  }
}

function build(
  mode: 'default' | 'none' | 's3',
  storage: MediaStorage | null,
  engine: WaEngine | null,
  defaultMode: 'none' | 's3' = 'none'
): MediaService {
  const manager = { getEngine: () => engine } as unknown as SessionManager
  const tenants = { getMediaStorage: async () => mode } as unknown as TenantRepository
  return new MediaService({ manager, tenants, storage, defaultMode, logger })
}

const fakeEngine = (chunks: string[] = ['hello']): WaEngine =>
  ({
    downloadMedia: async () => Readable.from(chunks.map((c) => Buffer.from(c)))
  }) as unknown as WaEngine

describe('MediaService.resolveForDispatch', () => {
  it('uploads media and rewrites content in s3 mode', async () => {
    const puts: { key: string; size: number }[] = []
    const storage: MediaStorage = {
      put: async (key, body) => {
        puts.push({ key, size: body.length })
        return { url: `https://cdn/${key}` }
      }
    }
    const service = build('s3', storage, fakeEngine())
    const result = await service.resolveForDispatch('t1', 's1', imageEvent())

    expect(puts).toHaveLength(1)
    expect(puts[0]!.key).toBe('t1/s1/M1.jpeg')
    expect(puts[0]!.size).toBe(5)
    if (result.type !== 'message' || result.content.type !== 'image') throw new Error('bad result')
    expect(result.content.media.url).toBe('https://cdn/t1/s1/M1.jpeg')
    expect(result.content.media.stored).toBe('s3')
    expect(result.content.media.mediaKey).toBeUndefined()
    expect(result.content.media.directPath).toBeUndefined()
  })

  it('passes through in none mode keeping pointers', async () => {
    const service = build('none', { put: async () => ({ url: 'x' }) }, fakeEngine())
    const event = imageEvent()
    const result = await service.resolveForDispatch('t1', 's1', event)
    expect(result).toBe(event)
  })

  it('uses default mode when tenant is default', async () => {
    const service = build('default', { put: async () => ({ url: 'x' }) }, fakeEngine(), 'none')
    const event = imageEvent()
    expect(await service.resolveForDispatch('t1', 's1', event)).toBe(event)
  })

  it('passes through when storage is null', async () => {
    const service = build('s3', null, fakeEngine())
    const event = imageEvent()
    expect(await service.resolveForDispatch('t1', 's1', event)).toBe(event)
  })

  it('passes through non-media messages', async () => {
    const service = build('s3', { put: async () => ({ url: 'x' }) }, fakeEngine())
    const event: EngineEvent = {
      type: 'message',
      chat: 'c',
      from: 'c',
      fromMe: false,
      isGroup: false,
      content: { type: 'text', text: 'hi' }
    }
    expect(await service.resolveForDispatch('t1', 's1', event)).toBe(event)
  })

  it('returns the original event when the upload fails', async () => {
    const storage: MediaStorage = {
      put: async () => {
        throw new Error('s3 down')
      }
    }
    const service = build('s3', storage, fakeEngine())
    const event = imageEvent()
    expect(await service.resolveForDispatch('t1', 's1', event)).toBe(event)
  })

  it('ignores non-message events', async () => {
    const service = build('s3', { put: async () => ({ url: 'x' }) }, fakeEngine())
    const event: EngineEvent = { type: 'qr', qr: 'Q' }
    expect(await service.resolveForDispatch('t1', 's1', event)).toBe(event)
  })
})

describe('MediaService.download', () => {
  it('throws when the session is not connected', async () => {
    const service = build('none', null, null)
    await expect(
      service.download('t1', 's1', { type: 'image', media: { mediaKey: 'K', directPath: '/v' } })
    ).rejects.toBeInstanceOf(AppError)
  })

  it('returns the engine stream', async () => {
    const service = build('none', null, fakeEngine(['abc']))
    const stream = await service.download('t1', 's1', {
      type: 'image',
      media: { mediaKey: 'K', directPath: '/v' }
    })
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).toString()).toBe('abc')
  })
})
