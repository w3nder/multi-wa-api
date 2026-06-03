import type { Pool } from '@multi-wa/db'
import { createPostgresStore, type WaPgStoreResult } from '@zapo-js/store-postgres'
import { createStore, type WaStore } from 'zapo-js'

export interface ZapoStoreBundle {
  result: WaPgStoreResult
  store: WaStore
}

export function buildZapoStore(pool: Pool, tablePrefix: string): ZapoStoreBundle {
  const result = createPostgresStore({ pool: pool as never, tablePrefix })
  const store = createStore({
    backends: { pg: result as never },
    providers: {
      auth: 'pg',
      signal: 'pg',
      preKey: 'pg',
      session: 'pg',
      identity: 'pg',
      senderKey: 'pg',
      appState: 'pg',
      privacyToken: 'pg',
      messages: 'pg',
      threads: 'pg',
      contacts: 'pg'
    }
  })
  return { result, store }
}
