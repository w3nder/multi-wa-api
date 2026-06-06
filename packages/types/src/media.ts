import { z } from 'zod/v4'
import { inboundMediaSchema } from './inbound'

export const mediaDownloadTypeSchema = z.enum(['image', 'video', 'audio', 'document', 'sticker'])
export type MediaDownloadType = z.infer<typeof mediaDownloadTypeSchema>

export const downloadMediaInputSchema = z.object({
  type: mediaDownloadTypeSchema,
  media: inboundMediaSchema
})
export type DownloadMediaInput = z.infer<typeof downloadMediaInputSchema>
export type MediaRef = DownloadMediaInput

export const mediaStorageModeSchema = z.enum(['default', 'none', 's3'])
export type MediaStorageMode = z.infer<typeof mediaStorageModeSchema>

export const tenantSettingsSchema = z.object({
  mediaStorage: mediaStorageModeSchema
})
export type TenantSettings = z.infer<typeof tenantSettingsSchema>

export const updateTenantSettingsInputSchema = tenantSettingsSchema
export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsInputSchema>
