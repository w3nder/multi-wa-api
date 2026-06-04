import { toUserJid, type GroupOperations } from '@multi-wa/core'
import type { GroupMetadata, GroupParticipant, ParticipantResult } from '@multi-wa/types'
import type { GroupMetadata as BaileysGroupMetadata, WASocket } from 'baileys'

export function mapBaileysMetadata(meta: BaileysGroupMetadata): GroupMetadata {
  return {
    id: meta.id,
    subject: meta.subject,
    owner: meta.owner ?? null,
    description: meta.desc ?? null,
    createdAt: meta.creation ?? null,
    announce: Boolean(meta.announce),
    restrict: Boolean(meta.restrict),
    size: meta.size ?? meta.participants.length,
    participants: meta.participants.map(
      (participant): GroupParticipant => ({
        id: participant.id,
        admin:
          participant.admin === 'superadmin'
            ? 'superadmin'
            : participant.admin === 'admin'
              ? 'admin'
              : null
      })
    )
  }
}

export function createBaileysGroups(getSocket: () => WASocket): GroupOperations {
  return {
    async create(input) {
      const meta = await getSocket().groupCreate(
        input.subject,
        (input.participants ?? []).map(toUserJid)
      )
      return mapBaileysMetadata(meta)
    },
    async metadata(groupId) {
      return mapBaileysMetadata(await getSocket().groupMetadata(groupId))
    },
    async updateSubject(groupId, subject) {
      await getSocket().groupUpdateSubject(groupId, subject)
    },
    async updateDescription(groupId, description) {
      await getSocket().groupUpdateDescription(groupId, description)
    },
    async updateParticipants(groupId, action, participants) {
      const results = await getSocket().groupParticipantsUpdate(
        groupId,
        participants.map(toUserJid),
        action
      )
      return results.map(
        (result): ParticipantResult => ({
          id: result.jid ?? '',
          status: Number(result.status)
        })
      )
    },
    async updateSetting(groupId, setting) {
      await getSocket().groupSettingUpdate(groupId, setting)
    },
    async inviteCode(groupId) {
      return (await getSocket().groupInviteCode(groupId)) ?? ''
    },
    async revokeInvite(groupId) {
      return (await getSocket().groupRevokeInvite(groupId)) ?? ''
    },
    async inviteInfo(code) {
      return mapBaileysMetadata(await getSocket().groupGetInviteInfo(code))
    },
    async acceptInvite(code) {
      return (await getSocket().groupAcceptInvite(code)) ?? ''
    },
    async leave(groupId) {
      await getSocket().groupLeave(groupId)
    }
  }
}
