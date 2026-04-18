import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const CreateFolderSchema = z.object({
  name:        z.string().min(1).max(120),
  workspaceId: z.string(),
  color:       z.string().max(40).optional(),
})

const UpdateFolderSchema = z.object({
  name:     z.string().min(1).max(120).optional(),
  color:    z.string().max(40).optional(),
  position: z.number().int().optional(),
})

export async function folderRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // List folders in a workspace
  app.get('/', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { workspaceId } = request.query as { workspaceId: string }

    const ws = await prisma.workspace.findFirst({
      where: { id: workspaceId, org: { members: { some: { userId: sub } } } },
    })
    if (!ws) return []

    return prisma.folder.findMany({
      where: { workspaceId },
      include: {
        boards: {
          select: { id: true, name: true, kind: true, updatedAt: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    })
  })

  app.post('/', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const body = CreateFolderSchema.parse(request.body)

    const ws = await prisma.workspace.findFirst({
      where: { id: body.workspaceId, org: { members: { some: { userId: sub } } } },
    })
    if (!ws) return reply.code(403).send({ error: 'Forbidden' })

    const last = await prisma.folder.findFirst({
      where: { workspaceId: body.workspaceId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const folder = await prisma.folder.create({
      data: {
        name: body.name,
        workspaceId: body.workspaceId,
        color: body.color ?? '#8B9BAE',
        position: (last?.position ?? -1) + 1,
      },
    })
    return reply.code(201).send(folder)
  })

  app.patch('/:folderId', auth, async (request) => {
    const { folderId } = request.params as { folderId: string }
    const patch = UpdateFolderSchema.parse(request.body)
    return prisma.folder.update({ where: { id: folderId }, data: patch })
  })

  app.delete('/:folderId', auth, async (request, reply) => {
    const { folderId } = request.params as { folderId: string }
    // Boards in the folder get moved to workspace root (folderId=null)
    await prisma.$transaction([
      prisma.board.updateMany({ where: { folderId }, data: { folderId: null } }),
      prisma.folder.delete({ where: { id: folderId } }),
    ])
    return reply.code(204).send()
  })
}
