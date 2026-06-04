import type {
  ApiKey,
  ApiKeyCreated,
  CreateGroupInput,
  CreateSessionInput,
  CreateWebhookInput,
  EngineEvent,
  EngineKind,
  GroupIdResult,
  GroupMetadata,
  GroupSetting,
  InviteCodeResult,
  MediaSource,
  MessageContent,
  ParticipantAction,
  ParticipantResult,
  Qr,
  SendMessageInput,
  SendMessageResult,
  Session,
  TokenPair,
  Webhook,
  WebhookCreated
} from '@multi-wa/types'
import { type Dispatcher, request } from 'undici'

export interface ClientOptions {
  baseUrl: string
  apiKey?: string
  accessToken?: string
}

export class WaApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'WaApiError'
  }
}

export interface MediaInput {
  url?: string
  base64?: string
}

function toMedia(input: MediaInput): MediaSource {
  if (input.url) return { url: input.url }
  if (input.base64) return { base64: input.base64 }
  throw new WaApiError(0, 'media requires url or base64')
}

export function createClient(options: ClientOptions) {
  const base = options.baseUrl.replace(/\/$/, '')

  const headers = (): Record<string, string> => {
    const value: Record<string, string> = { 'content-type': 'application/json' }
    if (options.apiKey) value['x-api-key'] = options.apiKey
    if (options.accessToken) value.authorization = `Bearer ${options.accessToken}`
    return value
  }

  async function call<T>(method: Dispatcher.HttpMethod, path: string, body?: unknown): Promise<T> {
    const response = await request(`${base}${path}`, {
      method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const text = await response.body.text()
    if (response.statusCode >= 400) {
      let message = text
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text
      } catch {
        /* keep raw text */
      }
      throw new WaApiError(response.statusCode, message)
    }
    return text ? (JSON.parse(text) as T) : (undefined as T)
  }

  async function* stream(path: string): AsyncGenerator<EngineEvent> {
    const response = await request(`${base}${path}`, { method: 'GET', headers: headers() })
    if (response.statusCode >= 400) {
      throw new WaApiError(response.statusCode, 'failed to open event stream')
    }
    let buffer = ''
    for await (const chunk of response.body) {
      buffer += chunk.toString()
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const dataLine = part.split('\n').find((line) => line.startsWith('data:'))
        if (!dataLine) continue
        const payload = dataLine.slice(5).trim()
        if (payload) yield JSON.parse(payload) as EngineEvent
      }
    }
  }

  const send = (sessionId: string, input: SendMessageInput): Promise<SendMessageResult> =>
    call('POST', `/sessions/${sessionId}/messages`, input)

  const client = {
    auth: {
      login: (email: string, password: string): Promise<TokenPair> =>
        call('POST', '/auth/login', { email, password }),
      refresh: (refreshToken: string): Promise<TokenPair> =>
        call('POST', '/auth/refresh', { refreshToken }),
      createApiKey: (name: string): Promise<ApiKeyCreated> =>
        call('POST', '/auth/api-keys', { name }),
      listApiKeys: (): Promise<ApiKey[]> => call('GET', '/auth/api-keys'),
      revokeApiKey: (id: string): Promise<void> => call('DELETE', `/auth/api-keys/${id}`)
    },
    sessions: {
      create: (input: CreateSessionInput): Promise<Session> => call('POST', '/sessions', input),
      list: (): Promise<Session[]> => call('GET', '/sessions'),
      get: (id: string): Promise<Session> => call('GET', `/sessions/${id}`),
      qr: (id: string): Promise<Qr> => call('GET', `/sessions/${id}/qr`),
      connect: (id: string): Promise<Session> => call('POST', `/sessions/${id}/connect`),
      disconnect: (id: string): Promise<Session> => call('POST', `/sessions/${id}/disconnect`),
      logout: (id: string): Promise<Session> => call('POST', `/sessions/${id}/logout`),
      remove: (id: string): Promise<void> => call('DELETE', `/sessions/${id}`),
      migrate: (id: string, to: EngineKind): Promise<{ session: Session; losses: unknown[] }> =>
        call('POST', `/sessions/${id}/migrate`, { to }),
      events: (id: string): AsyncGenerator<EngineEvent> => stream(`/sessions/${id}/events`)
    },
    messages: {
      send,
      sendContent: (sessionId: string, to: string, content: MessageContent) =>
        send(sessionId, { to, content }),
      sendText: (sessionId: string, to: string, text: string) =>
        send(sessionId, { to, content: { type: 'text', text } }),
      sendImage: (sessionId: string, to: string, media: MediaInput, caption?: string) =>
        send(sessionId, { to, content: { type: 'image', media: toMedia(media), caption } }),
      sendVideo: (sessionId: string, to: string, media: MediaInput, caption?: string) =>
        send(sessionId, { to, content: { type: 'video', media: toMedia(media), caption } }),
      sendAudio: (sessionId: string, to: string, media: MediaInput, voice?: boolean) =>
        send(sessionId, { to, content: { type: 'audio', media: toMedia(media), voice } }),
      sendDocument: (
        sessionId: string,
        to: string,
        media: MediaInput,
        filename?: string,
        mimetype?: string
      ) =>
        send(sessionId, {
          to,
          content: { type: 'document', media: toMedia(media), filename, mimetype }
        }),
      sendSticker: (sessionId: string, to: string, media: MediaInput) =>
        send(sessionId, { to, content: { type: 'sticker', media: toMedia(media) } }),
      sendLocation: (
        sessionId: string,
        to: string,
        latitude: number,
        longitude: number,
        name?: string,
        address?: string
      ) =>
        send(sessionId, {
          to,
          content: { type: 'location', latitude, longitude, name, address }
        }),
      sendContact: (sessionId: string, to: string, fullName: string, phone: string) =>
        send(sessionId, { to, content: { type: 'contact', fullName, phone } })
    },
    groups: {
      create: (sessionId: string, input: CreateGroupInput): Promise<GroupMetadata> =>
        call('POST', `/sessions/${sessionId}/groups`, input),
      get: (sessionId: string, groupId: string): Promise<GroupMetadata> =>
        call('GET', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}`),
      updateSubject: (sessionId: string, groupId: string, subject: string): Promise<void> =>
        call('PATCH', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/subject`, {
          subject
        }),
      updateDescription: (sessionId: string, groupId: string, description: string): Promise<void> =>
        call('PATCH', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/description`, {
          description
        }),
      updateParticipants: (
        sessionId: string,
        groupId: string,
        action: ParticipantAction,
        participants: string[]
      ): Promise<ParticipantResult[]> =>
        call('POST', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/participants`, {
          action,
          participants
        }),
      addParticipants: (sessionId: string, groupId: string, participants: string[]) =>
        client.groups.updateParticipants(sessionId, groupId, 'add', participants),
      removeParticipants: (sessionId: string, groupId: string, participants: string[]) =>
        client.groups.updateParticipants(sessionId, groupId, 'remove', participants),
      promote: (sessionId: string, groupId: string, participants: string[]) =>
        client.groups.updateParticipants(sessionId, groupId, 'promote', participants),
      demote: (sessionId: string, groupId: string, participants: string[]) =>
        client.groups.updateParticipants(sessionId, groupId, 'demote', participants),
      updateSettings: (sessionId: string, groupId: string, setting: GroupSetting): Promise<void> =>
        call('PATCH', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/settings`, {
          setting
        }),
      inviteCode: (sessionId: string, groupId: string): Promise<InviteCodeResult> =>
        call('GET', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/invite`),
      revokeInvite: (sessionId: string, groupId: string): Promise<InviteCodeResult> =>
        call('POST', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/invite/revoke`),
      inviteInfo: (sessionId: string, code: string): Promise<GroupMetadata> =>
        call('GET', `/sessions/${sessionId}/groups/invite/${encodeURIComponent(code)}`),
      join: (sessionId: string, invite: string): Promise<GroupIdResult> =>
        call('POST', `/sessions/${sessionId}/groups/join`, { invite }),
      leave: (sessionId: string, groupId: string): Promise<void> =>
        call('POST', `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/leave`)
    },
    webhooks: {
      create: (input: CreateWebhookInput): Promise<WebhookCreated> =>
        call('POST', '/webhooks', input),
      list: (): Promise<Webhook[]> => call('GET', '/webhooks'),
      remove: (id: string): Promise<void> => call('DELETE', `/webhooks/${id}`)
    }
  }

  return client
}

export type WaClient = ReturnType<typeof createClient>

export type {
  CreateSessionInput,
  CreateWebhookInput,
  EngineEvent,
  EngineKind,
  MessageContent,
  Session,
  TokenPair,
  Webhook
} from '@multi-wa/types'
