import { createPostgresStore, type WaPgStoreResult } from '@zapo-js/store-postgres'
import type { Pool } from 'pg'
import { createStore, type WaStore } from 'zapo-js'

export interface ZapoStoreBundle {
  result: WaPgStoreResult
  store: WaStore
}

export function buildZapoStore(pool: Pool, tablePrefix: string): ZapoStoreBundle {
  const result = createPostgresStore({ pool, tablePrefix })
  const store = createStore({
    backends: { pg: result },
    providers: {
      auth: 'pg',
      signal: 'pg',
      preKey: 'pg',
      session: 'pg',
      identity: 'pg',
      senderKey: 'pg',
      appState: 'pg',
      privacyToken: 'pg',
      messages: 'none',
      threads: 'none',
      contacts: 'none'
    }
  })
  return { result, store }
}
