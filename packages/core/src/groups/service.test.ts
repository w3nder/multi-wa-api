import type { GroupMetadata } from '@multi-wa/types'
import { describe, expect, it } from 'vitest'
import type { GroupOperations } from '../engine/types'
import { AppError } from '../lib/errors'
import type { SessionManager } from '../sessions/manager'
import { GroupService } from './service'

const metadata: GroupMetadata = {
  id: '123@g.us',
  subject: 'Test',
  owner: null,
  description: null,
  createdAt: null,
  announce: false,
  restrict: false,
  size: 0,
  participants: []
}

describe('GroupService', () => {
  it('delegates to the engine group operations', async () => {
    let captured: { subject: string } | undefined
    const groups = {
      create: async (input: { subject: string }) => {
        captured = input
        return metadata
      }
    } as unknown as GroupOperations
    const manager = { getEngine: () => ({ groups }) } as unknown as SessionManager
    const service = new GroupService(manager)

    const result = await service.create('s1', { subject: 'Test' })
    expect(result).toBe(metadata)
    expect(captured).toEqual({ subject: 'Test' })
  })

  it('throws conflict when the session is not connected', () => {
    const manager = { getEngine: () => null } as unknown as SessionManager
    const service = new GroupService(manager)
    expect(() => service.metadata('s1', '123@g.us')).toThrow(AppError)
  })
})
