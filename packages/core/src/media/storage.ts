export interface MediaStorage {
  put(key: string, body: Buffer, contentType?: string): Promise<{ url: string }>
}
