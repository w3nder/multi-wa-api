import { closePool, runMigrations } from '@multi-wa/db'
import { createContainer } from './container'
import { buildApp } from './http/server'

async function main(): Promise<void> {
  const container = createContainer()
  await runMigrations(container.pool)

  const { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_TENANT_NAME } = container.config
  if (BOOTSTRAP_ADMIN_EMAIL && BOOTSTRAP_ADMIN_PASSWORD) {
    await container.authService.ensureBootstrapUser(
      BOOTSTRAP_TENANT_NAME,
      BOOTSTRAP_ADMIN_EMAIL,
      BOOTSTRAP_ADMIN_PASSWORD
    )
  }

  await container.sessionService.resumeAll()

  const app = await buildApp(container)
  await app.listen({ host: container.config.HOST, port: container.config.PORT })

  const shutdown = async (): Promise<void> => {
    await app.close().catch(() => undefined)
    await container.manager.shutdown().catch(() => undefined)
    await closePool().catch(() => undefined)
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
