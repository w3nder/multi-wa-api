import { loadConfig, type Env } from '@multi-wa/config'
import {
  ApiKeyRepository,
  AuthService,
  getLogger,
  GroupService,
  MediaService,
  MessagingService,
  MigrationService,
  RefreshTokenRepository,
  SessionManager,
  SessionRepository,
  SessionService,
  TenantRepository,
  UserRepository,
  WebhookDispatcher,
  WebhookRepository,
  WebhookService,
  type EngineRegistry,
  type Logger,
  type SnapshotRegistry
} from '@multi-wa/core'
import { getPool, type Pool } from '@multi-wa/db'
import { baileysSnapshotAdapter, createBaileysEngine } from '@multi-wa/engine-baileys'
import { createZapoEngine, zapoSnapshotAdapter } from '@multi-wa/engine-zapo'
import { createS3Storage } from './media/s3'

export interface Container {
  config: Env
  logger: Logger
  pool: Pool
  authService: AuthService
  sessionService: SessionService
  messagingService: MessagingService
  groupService: GroupService
  webhookService: WebhookService
  mediaService: MediaService
  tenantRepository: TenantRepository
  manager: SessionManager
}

export function createContainer(): Container {
  const config = loadConfig()
  const logger = getLogger()
  const pool = getPool()

  const sessionRepository = new SessionRepository(pool)
  const webhookRepository = new WebhookRepository(pool)
  const userRepository = new UserRepository(pool)
  const apiKeyRepository = new ApiKeyRepository(pool)
  const refreshTokenRepository = new RefreshTokenRepository(pool)

  const dispatcher = new WebhookDispatcher(webhookRepository, logger, {
    timeoutMs: config.WEBHOOK_TIMEOUT_MS,
    maxRetries: config.WEBHOOK_MAX_RETRIES
  })

  const registry: EngineRegistry = {
    baileys: createBaileysEngine,
    zapo: createZapoEngine
  }

  const snapshots: SnapshotRegistry = {
    baileys: baileysSnapshotAdapter,
    zapo: zapoSnapshotAdapter
  }

  const tenantRepository = new TenantRepository(pool)
  const mediaStorage = createS3Storage(config)

  const manager = new SessionManager({
    pool,
    tablePrefix: config.WA_TABLE_PREFIX,
    logger,
    registry,
    repository: sessionRepository,
    onEvent: (tenantId, sessionId, event) => {
      void mediaService
        .resolveForDispatch(tenantId, sessionId, event)
        .then((resolved) => dispatcher.dispatch(tenantId, sessionId, resolved))
        .catch((error) => {
          logger.warn({ err: error, session: sessionId }, 'media resolution failed')
          dispatcher.dispatch(tenantId, sessionId, event)
        })
    }
  })

  const mediaService = new MediaService({
    manager,
    tenants: tenantRepository,
    storage: mediaStorage,
    defaultMode: config.MEDIA_STORAGE,
    logger
  })

  const migration = new MigrationService(snapshots, logger)

  const sessionService = new SessionService({
    repository: sessionRepository,
    manager,
    migration,
    snapshots,
    logger
  })

  const messagingService = new MessagingService(manager)
  const groupService = new GroupService(manager)
  const webhookService = new WebhookService(webhookRepository, dispatcher)
  const authService = new AuthService(
    userRepository,
    apiKeyRepository,
    refreshTokenRepository,
    config.JWT_REFRESH_TTL
  )

  return {
    config,
    logger,
    pool,
    authService,
    sessionService,
    messagingService,
    groupService,
    webhookService,
    mediaService,
    tenantRepository,
    manager
  }
}
