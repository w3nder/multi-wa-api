export const id = '0003_tenant_media_storage'

export const sql = `
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS media_storage text NOT NULL DEFAULT 'default';
`
