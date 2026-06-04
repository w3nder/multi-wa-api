import type {
  CreateGroupInput,
  GroupMetadata,
  GroupSetting,
  ParticipantAction,
  ParticipantResult
} from '@multi-wa/types'
import type { GroupOperations } from '../engine/types'
import { errors } from '../lib/errors'
import type { SessionManager } from '../sessions/manager'

export class GroupService {
  constructor(private readonly manager: SessionManager) {}

  private ops(sessionId: string): GroupOperations {
    const engine = this.manager.getEngine(sessionId)
    if (!engine) throw errors.conflict('session is not connected')
    return engine.groups
  }

  create(sessionId: string, input: CreateGroupInput): Promise<GroupMetadata> {
    return this.ops(sessionId).create(input)
  }

  metadata(sessionId: string, groupId: string): Promise<GroupMetadata> {
    return this.ops(sessionId).metadata(groupId)
  }

  updateSubject(sessionId: string, groupId: string, subject: string): Promise<void> {
    return this.ops(sessionId).updateSubject(groupId, subject)
  }

  updateDescription(sessionId: string, groupId: string, description: string): Promise<void> {
    return this.ops(sessionId).updateDescription(groupId, description)
  }

  updateParticipants(
    sessionId: string,
    groupId: string,
    action: ParticipantAction,
    participants: string[]
  ): Promise<ParticipantResult[]> {
    return this.ops(sessionId).updateParticipants(groupId, action, participants)
  }

  updateSetting(sessionId: string, groupId: string, setting: GroupSetting): Promise<void> {
    return this.ops(sessionId).updateSetting(groupId, setting)
  }

  inviteCode(sessionId: string, groupId: string): Promise<string> {
    return this.ops(sessionId).inviteCode(groupId)
  }

  revokeInvite(sessionId: string, groupId: string): Promise<string> {
    return this.ops(sessionId).revokeInvite(groupId)
  }

  inviteInfo(sessionId: string, code: string): Promise<GroupMetadata> {
    return this.ops(sessionId).inviteInfo(code)
  }

  acceptInvite(sessionId: string, code: string): Promise<string> {
    return this.ops(sessionId).acceptInvite(code)
  }

  leave(sessionId: string, groupId: string): Promise<void> {
    return this.ops(sessionId).leave(groupId)
  }
}
