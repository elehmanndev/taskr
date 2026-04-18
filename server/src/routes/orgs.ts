import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export async function orgRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // Create org
  app.post('/', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { name, slug } = request.body as { name: string; slug: string }

    const org = await prisma.org.create({
      data: {
        name,
        slug: slug.toLowerCase().replace(/\s+/g, '-'),
        members: { create: { userId: sub, role: 'OWNER' } },
      },
    })

    return reply.code(201).send(org)
  })

  // Get org by slug
  app.get('/:slug', auth, async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const { sub } = request.user as { sub: string }

    const org = await prisma.org.findFirst({
      where: {
        slug,
        members: { some: { userId: sub } },
      },
      include: {
        members: { include: { user: true } },
        workspaces: true,
      },
    })

    if (!org) return reply.code(404).send({ error: 'Org not found' })
    return org
  })

  // Invite user to org (by email)
  app.post('/:orgId/members', auth, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const { email, role = 'MEMBER' } = request.body as any

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const member = await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId, userId: user.id } },
      create: { orgId, userId: user.id, role },
      update: { role },
    })

    return reply.code(201).send(member)
  })

  // Remove member
  app.delete('/:orgId/members/:userId', auth, async (request, reply) => {
    const { orgId, userId } = request.params as { orgId: string; userId: string }
    await prisma.orgMember.deleteMany({ where: { orgId, userId } })
    return reply.code(204).send()
  })
}

// ── WebSocket route (board room joining) ──────────────────────────────────────
export async function wsRoutes(app: FastifyInstance) {
  // Socket.io handles this — this route is a placeholder
  // Real WS is initialized via initSocket() in server startup
  app.get('/ping', async () => ({ ok: true }))
}
