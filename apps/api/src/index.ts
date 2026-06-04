import { closePool, runMigrations } from '@multi-wa/db'
import { createContainer } from './container'
import { buildApp } from './http/server'

async function main(): Promise<void> {
  const container = createContainer()
  await runMigrations(container.pool)

  const { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_TENANT_NAME } =
    container.config
  if (BOOTSTRAP_ADMIN_EMAIL && BOOTSTRAP_ADMIN_PASSWORD) {
    await container.authService.ensureBootstrapUser(
      BOOTSTRAP_TENANT_NAME,
      BOOTSTRAP_ADMIN_EMAIL,
      BOOTSTRAP_ADMIN_PASSWORD
    )
  }

  const app = await buildApp(container)
  await app.listen({ host: container.config.HOST, port: container.config.PORT })

  void container.sessionService.resumeAll().catch((error) => {
    container.logger.warn({ err: error }, 'failed to resume sessions')
  })

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    container.logger.info({ signal }, 'shutting down')

    const force = setTimeout(() => {
      container.logger.warn('forced exit after shutdown timeout')
      process.exit(1)
    }, 8000)
    force.unref()

    await app.close().catch(() => undefined)
    await container.manager.shutdown().catch(() => undefined)
    await closePool().catch(() => undefined)

    clearTimeout(force)
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
