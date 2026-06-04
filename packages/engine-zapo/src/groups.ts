import { toUserJid, type GroupOperations } from '@multi-wa/core'
import type {
  GroupMetadata,
  GroupParticipant,
  GroupSetting,
  ParticipantAction,
  ParticipantResult
} from '@multi-wa/types'
import type { WaClient } from 'zapo-js'

type GroupCoordinator = WaClient['group']
type ZapoGroupMetadata = Awaited<ReturnType<GroupCoordinator['queryGroupMetadata']>>
type ZapoInviteInfo = Awaited<ReturnType<GroupCoordinator['queryGroupInviteInfo']>>
type ZapoActionResult = Awaited<ReturnType<GroupCoordinator['addParticipants']>>[number]

const PARTICIPANT_METHODS: Record<
  ParticipantAction,
  'addParticipants' | 'removeParticipants' | 'promoteParticipants' | 'demoteParticipants'
> = {
  add: 'addParticipants',
  remove: 'removeParticipants',
  promote: 'promoteParticipants',
  demote: 'demoteParticipants'
}

const SETTING_MAP: Record<
  GroupSetting,
  { setting: 'announcement' | 'restrict'; enabled: boolean }
> = {
  announcement: { setting: 'announcement', enabled: true },
  not_announcement: { setting: 'announcement', enabled: false },
  locked: { setting: 'restrict', enabled: true },
  unlocked: { setting: 'restrict', enabled: false }
}

export function mapZapoMetadata(meta: ZapoGroupMetadata): GroupMetadata {
  return {
    id: meta.jid,
    subject: meta.subject,
    owner: meta.owner ?? meta.subjectOwner ?? null,
    description: meta.desc ?? null,
    createdAt: meta.creation ?? null,
    announce: meta.announce,
    restrict: meta.restrict,
    size: meta.size ?? meta.participants.length,
    participants: meta.participants.map(
      (participant): GroupParticipant => ({
        id: participant.jid,
        admin: participant.isSuperAdmin ? 'superadmin' : participant.isAdmin ? 'admin' : null
      })
    )
  }
}

export function mapZapoInviteInfo(info: ZapoInviteInfo): GroupMetadata {
  return {
    id: info.jid,
    subject: info.subject,
    owner: info.subjectOwner ?? null,
    description: info.desc ?? null,
    createdAt: info.creation ?? null,
    announce: false,
    restrict: false,
    size: info.size ?? info.participants.length,
    participants: info.participants.map(
      (participant): GroupParticipant => ({ id: participant.jid, admin: null })
    )
  }
}

function mapActionResults(results: readonly ZapoActionResult[]): ParticipantResult[] {
  return results.map((result) => ({ id: result.jid, status: result.code }))
}

export function createZapoGroups(getCoordinator: () => GroupCoordinator): GroupOperations {
  return {
    async create(input) {
      const meta = await getCoordinator().createGroup(
        input.subject,
        (input.participants ?? []).map(toUserJid)
      )
      return mapZapoMetadata(meta)
    },
    async metadata(groupId) {
      return mapZapoMetadata(await getCoordinator().queryGroupMetadata(groupId))
    },
    async updateSubject(groupId, subject) {
      await getCoordinator().setSubject(groupId, subject)
    },
    async updateDescription(groupId, description) {
      await getCoordinator().setDescription(groupId, description)
    },
    async updateParticipants(groupId, action, participants) {
      const coordinator = getCoordinator()
      const jids = participants.map(toUserJid)
      const results = await coordinator[PARTICIPANT_METHODS[action]](groupId, jids)
      return mapActionResults(results)
    },
    async updateSetting(groupId, setting) {
      const { setting: name, enabled } = SETTING_MAP[setting]
      await getCoordinator().setSetting(groupId, name, enabled)
    },
    async inviteCode(groupId) {
      return getCoordinator().queryInviteCode(groupId)
    },
    async revokeInvite(groupId) {
      const coordinator = getCoordinator()
      await coordinator.revokeInvite(groupId)
      return coordinator.queryInviteCode(groupId)
    },
    async inviteInfo(code) {
      return mapZapoInviteInfo(await getCoordinator().queryGroupInviteInfo(code))
    },
    async acceptInvite(code) {
      const meta = await getCoordinator().joinGroupViaInvite(code)
      return meta.jid
    },
    async leave(groupId) {
      await getCoordinator().leaveGroup([groupId])
    }
  }
}
