export { getLogger } from './lib/logger'
export type { Logger } from './lib/logger'
export { AppError, errors } from './lib/errors'
export {
  hashPassword,
  verifyPassword,
  randomToken,
  sha256,
  constantTimeEqual,
  hmacSign
} from './lib/crypto'
export { toUserJid } from './lib/jid'

export type {
  EngineOptions,
  WaEngine,
  EngineFactory,
  EngineRegistry,
  EngineSnapshotAdapter,
  SnapshotRegistry,
  GroupOperations
} from './engine/types'

export { SessionRepository } from './sessions/repository'
export { SessionManager } from './sessions/manager'
export type { SessionManagerDeps, EngineEventListener } from './sessions/manager'
export { SessionService } from './sessions/service'
export type { SessionServiceDeps, MigrationResult } from './sessions/service'

export { MessagingService } from './messaging/service'

export { GroupService } from './groups/service'

export { MigrationService } from './migration/service'
export type { MigrationLoss } from './migration/service'

export { WebhookRepository } from './webhooks/repository'
export type { WebhookTarget } from './webhooks/repository'
export { WebhookDispatcher } from './webhooks/dispatcher'
export type { WebhookDispatcherOptions } from './webhooks/dispatcher'
export { WebhookService } from './webhooks/service'

export { UserRepository, ApiKeyRepository, RefreshTokenRepository } from './auth/repository'
export type { UserRecord, ApiKeyRecord, RefreshTokenRecord } from './auth/repository'
export { AuthService } from './auth/service'
export type { Principal, RefreshRotation } from './auth/service'
