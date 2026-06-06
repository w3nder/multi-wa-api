import { tenantSettingsSchema, updateTenantSettingsInputSchema } from '@multi-wa/types'
import type { Container } from '../../container'
import { SECURITY } from '../openapi'
import type { AppInstance } from '../types'

export function tenantRoutes(app: AppInstance, container: Container): void {
  app.get(
    '/settings',
    {
      schema: {
        tags: ['tenant'],
        summary: 'Get tenant settings',
        security: SECURITY,
        response: { 200: tenantSettingsSchema }
      }
    },
    async (request) => {
      const mediaStorage = await container.tenantRepository.getMediaStorage(
        request.principal.tenantId
      )
      return { mediaStorage }
    }
  )

  app.patch(
    '/settings',
    {
      schema: {
        tags: ['tenant'],
        summary: 'Update tenant settings',
        security: SECURITY,
        body: updateTenantSettingsInputSchema,
        response: { 200: tenantSettingsSchema }
      }
    },
    async (request) => {
      const mediaStorage = await container.tenantRepository.setMediaStorage(
        request.principal.tenantId,
        request.body.mediaStorage
      )
      return { mediaStorage }
    }
  )
}
