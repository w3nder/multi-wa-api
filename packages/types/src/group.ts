import { z } from 'zod/v4'

export const participantActionSchema = z.enum(['add', 'remove', 'promote', 'demote'])
export type ParticipantAction = z.infer<typeof participantActionSchema>

export const groupSettingSchema = z.enum(['announcement', 'not_announcement', 'locked', 'unlocked'])
export type GroupSetting = z.infer<typeof groupSettingSchema>

export const groupParticipantSchema = z.object({
  id: z.string(),
  admin: z.enum(['admin', 'superadmin']).nullable()
})
export type GroupParticipant = z.infer<typeof groupParticipantSchema>

export const groupMetadataSchema = z.object({
  id: z.string(),
  subject: z.string(),
  owner: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.number().nullable(),
  announce: z.boolean(),
  restrict: z.boolean(),
  size: z.number(),
  participants: z.array(groupParticipantSchema)
})
export type GroupMetadata = z.infer<typeof groupMetadataSchema>

export const participantResultSchema = z.object({
  id: z.string(),
  status: z.number()
})
export type ParticipantResult = z.infer<typeof participantResultSchema>

export const createGroupInputSchema = z.object({
  subject: z.string().min(1).max(100),
  participants: z.array(z.string().min(1)).optional()
})
export type CreateGroupInput = z.infer<typeof createGroupInputSchema>

export const updateSubjectInputSchema = z.object({ subject: z.string().min(1).max(100) })
export type UpdateSubjectInput = z.infer<typeof updateSubjectInputSchema>

export const updateDescriptionInputSchema = z.object({ description: z.string() })
export type UpdateDescriptionInput = z.infer<typeof updateDescriptionInputSchema>

export const updateParticipantsInputSchema = z.object({
  action: participantActionSchema,
  participants: z.array(z.string().min(1)).min(1)
})
export type UpdateParticipantsInput = z.infer<typeof updateParticipantsInputSchema>

export const updateGroupSettingInputSchema = z.object({ setting: groupSettingSchema })
export type UpdateGroupSettingInput = z.infer<typeof updateGroupSettingInputSchema>

export const joinGroupInputSchema = z.object({ invite: z.string().min(1) })
export type JoinGroupInput = z.infer<typeof joinGroupInputSchema>

export const inviteCodeResultSchema = z.object({ code: z.string() })
export type InviteCodeResult = z.infer<typeof inviteCodeResultSchema>

export const groupIdResultSchema = z.object({ id: z.string() })
export type GroupIdResult = z.infer<typeof groupIdResultSchema>
