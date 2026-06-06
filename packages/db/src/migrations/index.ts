import * as init from './0001_init'
import * as sessionNameNotUnique from './0002_session_name_not_unique'
import * as tenantMediaStorage from './0003_tenant_media_storage'

export interface Migration {
  id: string
  sql: string
}

export const migrations: Migration[] = [
  { id: init.id, sql: init.sql },
  { id: sessionNameNotUnique.id, sql: sessionNameNotUnique.sql },
  { id: tenantMediaStorage.id, sql: tenantMediaStorage.sql }
]
