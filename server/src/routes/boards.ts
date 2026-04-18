import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { emitToBoard } from '../lib/socket.js'

const CreateBoardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workspaceId: z.string().optional(),
  kind: z.enum(['PUBLIC', 'PRIVATE', 'SHAREABLE']).default('PUBLIC'),
})

const DEFAULT_GROUPS = ['To Do', 'In Progress', 'Done']
const DEFAULT_COLUMNS = [
  { title: 'Status',  type: 'STATUS',  position: 0, settings: {
    labels: [
      { id: 0,   label: 'To Do',       color: 'working_orange', index: 0, is_done: false },
      { id: 1,   label: 'In Progress', color: 'bright_blue',    index: 1, is_done: false },
      { id: 2,   label: 'Done',        color: 'done_green',     index: 2, is_done: true  },
      { id: 3,   label: 'Stuck',       color: 'stuck_red',      index: 3, is_done: false },
    ]
  }},
  { title: 'Assignee', type: 'PEOPLE',   position: 1, settings: {} },
  { title: 'Due Date', type: 'DATE',     position: 2, settings: {} },
  { title: 'Priority', type: 'STATUS',   position: 3, settings: {
    labels: [
      { id: 0, label: 'Critical', color: 'stuck_red',      index: 0, is_done: false },
      { id: 1, label: 'High',     color: 'working_orange', index: 1, is_done: false },
      { id: 2, label: 'Medium',   color: 'egg_yolk',       index: 2, is_done: false },
      { id: 3, label: 'Low',      color: 'done_green',     index: 3, is_done: false },
    ]
  }},
]

export async function boardRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // List boards for an org
  app.get('/', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { orgId } = request.query as { orgId: string }

    return prisma.board.findMany({
      where: {
        orgId,
        OR: [
          { kind: 'PUBLIC' },
          { members: { some: { userId: sub } } },
        ],
      },
      include: {
        _count: { select: { items: true } },
        members: { where: { userId: sub } },
      },
      orderBy: { createdAt: 'asc' },
    })
  })

  // Get single board with full schema
  app.get('/:boardId', auth, async (request, reply) => {
    const { boardId } = request.params as { boardId: string }
    const { sub } = request.user as { sub: string }

    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { kind: 'PUBLIC' },
          { members: { some: { userId: sub } } },
        ],
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
        groups: {
          orderBy: { position: 'asc' },
          include: {
            items: {
              orderBy: { position: 'asc' },
              include: {
                assignees: { include: { user: true } },
                _count: { select: { comments: true, attachments: true } },
              },
            },
          },
        },
        members: { include: { board: false } },
      },
    })

    if (!board) return reply.code(404).send({ error: 'Board not found' })
    return board
  })

  // Create board with default groups + columns
  app.post('/', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const body = CreateBoardSchema.parse(request.body)
    const { orgId } = request.query as { orgId: string }

    const board = await prisma.$transaction(async (tx) => {
      const b = await tx.board.create({
        data: {
          ...body,
          orgId,
          members: {
            create: { userId: sub, role: 'OWNER' },
          },
        },
      })

      // Default groups
      await tx.group.createMany({
        data: DEFAULT_GROUPS.map((name, i) => ({
          boardId: b.id,
          name,
          position: i,
          color: ['#0073EA', '#FDAB3D', '#00CA72'][i],
        })),
      })

      // Default columns
      await tx.column.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({
          boardId: b.id,
          title: c.title,
          type: c.type as any,
          settings: c.settings,
          position: c.position,
        })),
      })

      return b
    })

    return reply.code(201).send(board)
  })

  // Update board
  app.patch('/:boardId', auth, async (request) => {
    const { boardId } = request.params as { boardId: string }
    const body = request.body as any

    const board = await prisma.board.update({
      where: { id: boardId },
      data: { name: body.name, description: body.description, kind: body.kind },
    })

    emitToBoard(boardId, 'board:updated', board)
    return board
  })

  // Delete board
  app.delete('/:boardId', auth, async (request, reply) => {
    const { boardId } = request.params as { boardId: string }
    await prisma.board.delete({ where: { id: boardId } })
    return reply.code(204).send()
  })
}
