import type { EngineOptions, EngineSnapshotAdapter } from '@multi-wa/core'
import { buildZapoStore } from './store'

interface ZapoSignalAddress {
  name: string
  deviceId: number
}

interface ZapoWriteSnapshot {
  credentials: unknown
  preKeys?: unknown[]
  identities?: { address: ZapoSignalAddress; identityKey: Uint8Array }[]
  sessions?: { address: ZapoSignalAddress; record: unknown }[]
  senderKeys?: { record: unknown }[]
  appState?: {
    keys: unknown[]
    collections: Record<string, { version: number; hash: Uint8Array; indexValueMap: Record<string, Uint8Array> }>
  }
  privacyTokens?: unknown[]
  deviceLists?: unknown[]
}

export async function readZapoSnapshot(options: EngineOptions): Promise<unknown> {
  const { store } = buildZapoStore(options.pool, options.tablePrefix)
  const session = store.session(options.sessionId)
  const credentials = await session.auth.load()
  if (!credentials) throw new Error('no zapo credentials to migrate')
  const appState = await session.appState.exportData()
  return { credentials, appState }
}

export async function writeZapoSnapshot(options: EngineOptions, data: unknown): Promise<void> {
  const snapshot = data as ZapoWriteSnapshot
  const { store } = buildZapoStore(options.pool, options.tablePrefix)
  const session = store.session(options.sessionId)

  await session.auth.save(snapshot.credentials as never)

  for (const preKey of snapshot.preKeys ?? []) {
    await session.preKey.putPreKey(preKey as never)
  }

  if (snapshot.identities?.length) {
    await session.identity.setRemoteIdentities(
      snapshot.identities.map((item) => ({ address: item.address, identityKey: item.identityKey })) as never
    )
  }

  if (snapshot.sessions?.length) {
    await session.session.setSessionsBatch(
      snapshot.sessions.map((item) => ({ address: item.address, session: item.record })) as never
    )
  }

  for (const senderKey of snapshot.senderKeys ?? []) {
    await session.senderKey.upsertSenderKey(senderKey.record as never)
  }

  if (snapshot.appState) {
    await session.appState.upsertSyncKeys(snapshot.appState.keys as never)
    const updates = Object.entries(snapshot.appState.collections).map(([collection, value]) => ({
      collection: collection as never,
      version: value.version,
      hash: value.hash,
      indexValueMap: new Map(Object.entries(value.indexValueMap))
    }))
    if (updates.length > 0) await session.appState.setCollectionStates(updates as never)
  }

  if (snapshot.privacyTokens?.length) {
    await session.privacyToken.upsertBatch(snapshot.privacyTokens as never)
  }

  if (snapshot.deviceLists?.length) {
    await session.deviceList.upsertUserDevicesBatch(snapshot.deviceLists as never)
  }
}

export async function clearZapo(options: EngineOptions): Promise<void> {
  const { store } = buildZapoStore(options.pool, options.tablePrefix)
  const session = store.session(options.sessionId)
  await Promise.allSettled([
    session.auth.clear(),
    session.signal.clear(),
    session.preKey.clear(),
    session.session.clear(),
    session.identity.clear(),
    session.senderKey.clear(),
    session.appState.clear(),
    session.privacyToken.clear(),
    session.deviceList.clear()
  ])
}

export const zapoSnapshotAdapter: EngineSnapshotAdapter = {
  read: readZapoSnapshot,
  write: writeZapoSnapshot,
  clear: clearZapo
}
