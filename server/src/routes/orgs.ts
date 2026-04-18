import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireOrgAdmin } from '../middleware/access.js'

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

  // Invite user to org (by email) — OWNER/ADMIN only
  app.post('/:orgId/members', { onRequest: auth.onRequest, preHandler: requireOrgAdmin() }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const { email, role = 'MEMBER' } = request.body as any
    const callerRole = (request as any).orgRole as 'OWNER' | 'ADMIN'

    // Only OWNER can grant OWNER/ADMIN; ADMINs can only add MEMBER/GUEST
    if (callerRole !== 'OWNER' && (role === 'OWNER' || role === 'ADMIN')) {
      return reply.code(403).send({ error: 'Only OWNER can grant OWNER or ADMIN' })
    }
    if (!['OWNER', 'ADMIN', 'MEMBER', 'GUEST'].includes(role)) {
      return reply.code(400).send({ error: 'Invalid role' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const member = await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId, userId: user.id } },
      create: { orgId, userId: user.id, role },
      update: { role },
    })

    return reply.code(201).send(member)
  })

  // Remove member — OWNER/ADMIN only, block removing last OWNER
  app.delete('/:orgId/members/:userId', { onRequest: auth.onRequest, preHandler: requireOrgAdmin() }, async (request, reply) => {
    const { orgId, userId } = request.params as { orgId: string; userId: string }

    const target = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { role: true },
    })
    if (!target) return reply.code(204).send()

    if (target.role === 'OWNER') {
      const ownerCount = await prisma.orgMember.count({
        where: { orgId, role: 'OWNER' },
      })
      if (ownerCount <= 1) {
        return reply.code(400).send({ error: 'Cannot remove the last OWNER' })
      }
    }

    await prisma.orgMember.delete({
      where: { orgId_userId: { orgId, userId } },
    })
    return reply.code(204).send()
  })
}

// ── WebSocket route (board room joining) ──────────────────────────────────────
export async function wsRoutes(app: FastifyInstance) {
  // Socket.io handles this — this route is a placeholder
  // Real WS is initialized via initSocket() in server startup
  app.get('/ping', async () => ({ ok: true }))
}
