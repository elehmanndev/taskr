import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { emitToBoard } from '../lib/socket.js'

export async function groupRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.post('/', auth, async (request, reply) => {
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

  app.patch('/:groupId', auth, async (request) => {
    const { boardId, groupId } = request.params as { boardId: string; groupId: string }
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

  app.delete('/:groupId', auth, async (request, reply) => {
    const { boardId, groupId } = request.params as { boardId: string; groupId: string }
    await prisma.group.delete({ where: { id: groupId } })
    emitToBoard(boardId, 'group:deleted', { groupId })
    return reply.code(204).send()
  })
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function commentRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.get('/', auth, async (request) => {
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

  app.post('/', auth, async (request, reply) => {
    const { itemId } = request.params as { itemId: string }
    const { sub } = request.user as { sub: string }
    const { body, parentId, mentions = [] } = request.body as any

    const comment = await prisma.comment.create({
      data: { itemId, userId: sub, body, parentId, mentions },
      include: { user: true },
    })

    // Notify mentioned users
    for (const mention of mentions) {
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

  app.patch('/:commentId', auth, async (request) => {
    const { commentId } = request.params as { commentId: string }
    const { body } = request.body as { body: string }

    return prisma.comment.update({
      where: { id: commentId },
      data: { body, editedAt: new Date() },
      include: { user: true },
    })
  })

  app.delete('/:commentId', auth, async (request, reply) => {
    const { commentId } = request.params as { commentId: string }
    await prisma.comment.delete({ where: { id: commentId } })
    return reply.code(204).send()
  })
}
