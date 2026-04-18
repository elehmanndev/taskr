import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { emitToBoard } from '../lib/socket.js'
import { automationQueue } from '../lib/queues.js'

export async function itemRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // Create item
  app.post('/', auth, async (request, reply) => {
    const { boardId } = request.params as { boardId: string }
    const { sub } = request.user as { sub: string }
    const { name, groupId, columnValues = {} } = request.body as any

    // Get max position in group
    const last = await prisma.item.findFirst({
      where: { groupId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const item = await prisma.item.create({
      data: {
        boardId,
        groupId,
        name,
        columnValues,
        position: (last?.position ?? -1) + 1,
        createdById: sub,
      },
      include: {
        assignees: { include: { user: true } },
        _count: { select: { comments: true } },
      },
    })

    emitToBoard(boardId, 'item:created', item)

    // Fire automation trigger
    await automationQueue.add('trigger', {
      boardId,
      triggerType: 'ITEM_CREATED',
      itemId: item.id,
      payload: { item },
    })

    return reply.code(201).send(item)
  })

  // Update item (name, columnValues, groupId, position)
  app.patch('/:itemId', auth, async (request) => {
    const { boardId, itemId } = request.params as { boardId: string; itemId: string }
    const body = request.body as any

    const prev = await prisma.item.findUnique({
      where: { id: itemId },
      select: { columnValues: true, groupId: true },
    })

    const item = await prisma.item.update({
      where: { id: itemId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.columnValues !== undefined && { columnValues: body.columnValues }),
        ...(body.groupId !== undefined && { groupId: body.groupId }),
        ...(body.position !== undefined && { position: body.position }),
      },
      include: {
        assignees: { include: { user: true } },
        _count: { select: { comments: true } },
      },
    })

    emitToBoard(boardId, 'item:updated', item)

    // Detect column changes for automations
    if (body.columnValues && prev?.columnValues) {
      const prevVals = prev.columnValues as Record<string, any>
      const newVals  = body.columnValues as Record<string, any>

      for (const colId of Object.keys(newVals)) {
        if (JSON.stringify(prevVals[colId]) !== JSON.stringify(newVals[colId])) {
          await automationQueue.add('trigger', {
            boardId,
            triggerType: 'COLUMN_CHANGED',
            itemId,
            payload: {
              columnId: colId,
              previousValue: prevVals[colId],
              newValue: newVals[colId],
            },
          })
        }
      }
    }

    // Detect group move
    if (body.groupId && body.groupId !== prev?.groupId) {
      await automationQueue.add('trigger', {
        boardId,
        triggerType: 'ITEM_MOVED',
        itemId,
        payload: { fromGroupId: prev?.groupId, toGroupId: body.groupId },
      })
    }

    return item
  })

  // Bulk reorder (drag and drop)
  app.post('/reorder', auth, async (request) => {
    const { boardId } = request.params as { boardId: string }
    const { updates } = request.body as {
      updates: Array<{ id: string; groupId: string; position: number }>
    }

    await prisma.$transaction(
      updates.map(({ id, groupId, position }) =>
        prisma.item.update({
          where: { id },
          data: { groupId, position },
        })
      )
    )

    emitToBoard(boardId, 'items:reordered', { updates })
    return { ok: true }
  })

  // Delete item
  app.delete('/:itemId', auth, async (request, reply) => {
    const { boardId, itemId } = request.params as { boardId: string; itemId: string }
    await prisma.item.delete({ where: { id: itemId } })
    emitToBoard(boardId, 'item:deleted', { itemId })
    return reply.code(204).send()
  })

  // Get single item (for detail panel)
  app.get('/:itemId', auth, async (request, reply) => {
    const { itemId } = request.params as { itemId: string }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        assignees: { include: { user: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: true,
            replies: { include: { user: true } },
          },
          where: { parentId: null },
        },
        attachments: { orderBy: { createdAt: 'asc' } },
        group: true,
      },
    })

    if (!item) return reply.code(404).send({ error: 'Item not found' })
    return item
  })
}
