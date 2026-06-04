import {
  createGroupInputSchema,
  groupIdResultSchema,
  groupMetadataSchema,
  inviteCodeResultSchema,
  joinGroupInputSchema,
  participantResultSchema,
  updateDescriptionInputSchema,
  updateGroupSettingInputSchema,
  updateParticipantsInputSchema,
  updateSubjectInputSchema
} from '@multi-wa/types'
import { z } from 'zod/v4'
import type { Container } from '../../container'
import { SECURITY } from '../openapi'
import type { AppInstance } from '../types'

const TAGS = ['groups']
const sessionParam = z.object({ id: z.uuid() })
const groupParam = z.object({ id: z.uuid(), groupId: z.string().min(1) })
const inviteParam = z.object({ id: z.uuid(), code: z.string().min(1) })

export function groupRoutes(app: AppInstance, container: Container): void {
  const tenant = (request: { principal: { tenantId: string } }) => request.principal.tenantId
  const ensure = (request: { principal: { tenantId: string }; params: { id: string } }) =>
    container.sessionService.get(tenant(request), request.params.id)

  app.post(
    '/:id/groups',
    {
      schema: {
        tags: TAGS,
        summary: 'Create a group',
        security: SECURITY,
        params: sessionParam,
        body: createGroupInputSchema,
        response: { 201: groupMetadataSchema }
      }
    },
    async (request, reply) => {
      await ensure(request)
      const group = await container.groupService.create(request.params.id, request.body)
      return reply.status(201).send(group)
    }
  )

  app.get(
    '/:id/groups/invite/:code',
    {
      schema: {
        tags: TAGS,
        summary: 'Preview a group via invite code',
        security: SECURITY,
        params: inviteParam,
        response: { 200: groupMetadataSchema }
      }
    },
    async (request) => {
      await ensure(request)
      return container.groupService.inviteInfo(request.params.id, request.params.code)
    }
  )

  app.post(
    '/:id/groups/join',
    {
      schema: {
        tags: TAGS,
        summary: 'Join a group via invite code',
        security: SECURITY,
        params: sessionParam,
        body: joinGroupInputSchema,
        response: { 200: groupIdResultSchema }
      }
    },
    async (request) => {
      await ensure(request)
      const id = await container.groupService.acceptInvite(request.params.id, request.body.invite)
      return { id }
    }
  )

  app.get(
    '/:id/groups/:groupId',
    {
      schema: {
        tags: TAGS,
        summary: 'Get group metadata',
        security: SECURITY,
        params: groupParam,
        response: { 200: groupMetadataSchema }
      }
    },
    async (request) => {
      await ensure(request)
      return container.groupService.metadata(request.params.id, request.params.groupId)
    }
  )

  app.patch(
    '/:id/groups/:groupId/subject',
    {
      schema: {
        tags: TAGS,
        summary: 'Update group subject',
        security: SECURITY,
        params: groupParam,
        body: updateSubjectInputSchema
      }
    },
    async (request, reply) => {
      await ensure(request)
      await container.groupService.updateSubject(
        request.params.id,
        request.params.groupId,
        request.body.subject
      )
      return reply.status(204).send()
    }
  )

  app.patch(
    '/:id/groups/:groupId/description',
    {
      schema: {
        tags: TAGS,
        summary: 'Update group description',
        security: SECURITY,
        params: groupParam,
        body: updateDescriptionInputSchema
      }
    },
    async (request, reply) => {
      await ensure(request)
      await container.groupService.updateDescription(
        request.params.id,
        request.params.groupId,
        request.body.description
      )
      return reply.status(204).send()
    }
  )

  app.post(
    '/:id/groups/:groupId/participants',
    {
      schema: {
        tags: TAGS,
        summary: 'Add, remove, promote or demote participants',
        security: SECURITY,
        params: groupParam,
        body: updateParticipantsInputSchema,
        response: { 200: z.array(participantResultSchema) }
      }
    },
    async (request) => {
      await ensure(request)
      return container.groupService.updateParticipants(
        request.params.id,
        request.params.groupId,
        request.body.action,
        request.body.participants
      )
    }
  )

  app.patch(
    '/:id/groups/:groupId/settings',
    {
      schema: {
        tags: TAGS,
        summary: 'Update group settings (who can send/edit)',
        security: SECURITY,
        params: groupParam,
        body: updateGroupSettingInputSchema
      }
    },
    async (request, reply) => {
      await ensure(request)
      await container.groupService.updateSetting(
        request.params.id,
        request.params.groupId,
        request.body.setting
      )
      return reply.status(204).send()
    }
  )

  app.get(
    '/:id/groups/:groupId/invite',
    {
      schema: {
        tags: TAGS,
        summary: 'Get the group invite code',
        security: SECURITY,
        params: groupParam,
        response: { 200: inviteCodeResultSchema }
      }
    },
    async (request) => {
      await ensure(request)
      const code = await container.groupService.inviteCode(
        request.params.id,
        request.params.groupId
      )
      return { code }
    }
  )

  app.post(
    '/:id/groups/:groupId/invite/revoke',
    {
      schema: {
        tags: TAGS,
        summary: 'Revoke and regenerate the group invite code',
        security: SECURITY,
        params: groupParam,
        response: { 200: inviteCodeResultSchema }
      }
    },
    async (request) => {
      await ensure(request)
      const code = await container.groupService.revokeInvite(
        request.params.id,
        request.params.groupId
      )
      return { code }
    }
  )

  app.post(
    '/:id/groups/:groupId/leave',
    {
      schema: {
        tags: TAGS,
        summary: 'Leave a group',
        security: SECURITY,
        params: groupParam
      }
    },
    async (request, reply) => {
      await ensure(request)
      await container.groupService.leave(request.params.id, request.params.groupId)
      return reply.status(204).send()
    }
  )
}
