import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Env } from '@multi-wa/config'
import type { MediaStorage } from '@multi-wa/core'

export function createS3Storage(env: Env): MediaStorage | null {
  if (env.MEDIA_STORAGE !== 's3') return null
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_PUBLIC_URL) {
    return null
  }

  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    }
  })

  const bucket = env.S3_BUCKET
  const base = env.S3_PUBLIC_URL.replace(/\/+$/, '')

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
      )
      return { url: `${base}/${key}` }
    }
  }
}
