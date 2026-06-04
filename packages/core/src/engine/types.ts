import type { Pool } from '@multi-wa/db'
import type {
  CreateGroupInput,
  EngineEvent,
  EngineKind,
  GroupMetadata,
  GroupSetting,
  MessageContent,
  ParticipantAction,
  ParticipantResult,
  SendMessageResult
} from '@multi-wa/types'
import type { Logger } from '../lib/logger'

export interface EngineOptions {
  sessionId: string
  pool: Pool
  tablePrefix: string
  logger: Logger
}

export interface GroupOperations {
  create(input: CreateGroupInput): Promise<GroupMetadata>
  metadata(groupId: string): Promise<GroupMetadata>
  updateSubject(groupId: string, subject: string): Promise<void>
  updateDescription(groupId: string, description: string): Promise<void>
  updateParticipants(
    groupId: string,
    action: ParticipantAction,
    participants: string[]
  ): Promise<ParticipantResult[]>
  updateSetting(groupId: string, setting: GroupSetting): Promise<void>
  inviteCode(groupId: string): Promise<string>
  revokeInvite(groupId: string): Promise<string>
  inviteInfo(code: string): Promise<GroupMetadata>
  acceptInvite(code: string): Promise<string>
  leave(groupId: string): Promise<void>
}

export interface WaEngine {
  readonly kind: EngineKind
  start(): Promise<void>
  stop(): Promise<void>
  logout(): Promise<void>
  send(to: string, content: MessageContent): Promise<SendMessageResult>
  readonly groups: GroupOperations
  onEvent(handler: (event: EngineEvent) => void): void
}

export type EngineFactory = (options: EngineOptions) => WaEngine
export type EngineRegistry = Record<EngineKind, EngineFactory>

export interface EngineSnapshotAdapter {
  read(options: EngineOptions): Promise<unknown>
  write(options: EngineOptions, data: unknown): Promise<void>
  clear(options: EngineOptions): Promise<void>
}

export type SnapshotRegistry = Record<EngineKind, EngineSnapshotAdapter>
