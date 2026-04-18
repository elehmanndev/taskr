import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { emitToBoard } from '../lib/socket.js'
import {
  requireBoardAccess,
  requireGroupAccess,
  requireItemAccessForComment,
  requireCommentOwner,
} from '../middleware/access.js'

export async function groupRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.post('/', { onRequest: auth.onRequest, preHandler: requireBoardAccess }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string }
    const { name, color } = request.body as any

    const last = await prisma.group.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const group = await prisma.group.create({
      data: { boardId, name, color: color ?? '#0073EA', position: (last?.position ?? -1) + 1 },
    })

    emitToBoard(boardId, 'group:created', group)
    return reply.code(201).send(group)
  })

  app.patch('/:groupId', { onRequest: auth.onRequest, preHandler: requireGroupAccess }, async (request) => {
    const { groupId } = request.params as { groupId: string }
    const boardId = ((request as any).group as { boardId: string }).boardId
    const body = request.body as any

    const group = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(body.name      !== undefined && { name: body.name }),
        ...(body.color     !== undefined && { color: body.color }),
        ...(body.position  !== undefined && { position: body.position }),
        ...(body.collapsed !== undefined && { collapsed: body.collapsed }),
      },
    })

    emitToBoard(boardId, 'group:updated', group)
    return group
  })

  app.delete('/:groupId', { onRequest: auth.onRequest, preHandler: requireGroupAccess }, async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    const boardId = ((request as any).group as { boardId: string }).boardId
    await prisma.group.delete({ where: { id: groupId } })
    emitToBoard(boardId, 'group:deleted', { groupId })
    return reply.code(204).send()
  })
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function commentRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.get('/', { onRequest: auth.onRequest, preHandler: requireItemAccessForComment }, async (request) => {
    const { itemId } = request.params as { itemId: string }
    return prisma.comment.findMany({
      where: { itemId, parentId: null },
      include: {
        user: true,
        replies: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    })
  })

  app.post('/', { onRequest: auth.onRequest, preHandler: requireItemAccessForComment }, async (request, reply) => {
    const { itemId } = request.params as { itemId: string }
    const { sub } = request.user as { sub: string }
    const { body, parentId, mentions = [] } = request.body as any
    const board = (request as any).board as { orgId: string }

    // Only allow mentioning users who share the org with the commenter
    const safeMentions: Array<{ userId: string; name?: string }> = []
    if (Array.isArray(mentions) && mentions.length) {
      const mentionIds = mentions.map((m: any) => m?.userId).filter(Boolean)
      const validMembers = await prisma.orgMember.findMany({
        where: { orgId: board.orgId, userId: { in: mentionIds } },
        select: { userId: true },
      })
      const validSet = new Set(validMembers.map((m) => m.userId))
      for (const m of mentions) {
        if (m?.userId && validSet.has(m.userId)) {
          safeMentions.push({ userId: m.userId, name: typeof m.name === 'string' ? m.name : undefined })
        }
      }
    }

    const comment = await prisma.comment.create({
      data: { itemId, userId: sub, body, parentId, mentions: safeMentions },
      include: { user: true },
    })

    for (const mention of safeMentions) {
      await prisma.notification.create({
        data: {
          userId: mention.userId,
          type: 'COMMENT_MENTION',
          title: `You were mentioned in a comment`,
          entityId: itemId,
        },
      })
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { boardId: true },
    })
    if (item) emitToBoard(item.boardId, 'comment:created', { itemId, comment })

    return reply.code(201).send(comment)
  })

  app.patch('/:commentId', { onRequest: auth.onRequest, preHandler: requireCommentOwner }, async (request) => {
    const { commentId } = request.params as { commentId: string }
    const { body } = request.body as { body: string }

    return prisma.comment.update({
      where: { id: commentId },
      data: { body, editedAt: new Date() },
      include: { user: true },
    })
  })

  app.delete('/:commentId', { onRequest: auth.onRequest, preHandler: requireCommentOwner }, async (request, reply) => {
    const { commentId } = request.params as { commentId: string }
    await prisma.comment.delete({ where: { id: commentId } })
    return reply.code(204).send()
  })
}
