import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const LANGUAGE_CODES = ['es', 'ca', 'en', 'fr', 'pt', 'de', 'it'] as const

const ProfileUpdateSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  avatarUrl:   z.string().url().nullable().optional(),
  department:  z.string().max(120).nullable().optional(),
  group:       z.string().max(120).nullable().optional(),
  claudeMd:    z.string().max(20000).nullable().optional(),
  expertise:   z.array(z.string().min(1).max(60)).max(50).optional(),
  languages:   z.record(z.enum(LANGUAGE_CODES), z.number().int().min(1).max(4)).optional(),
  slackUrl:    z.string().url().nullable().optional(),
})

const PUBLIC_PROFILE_FIELDS = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  department: true,
  group: true,
  claudeMd: true,
  expertise: true,
  languages: true,
  slackUrl: true,
  createdAt: true,
} as const

export async function userRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // Search users (within current user's orgs). Used by @mentions + assignee pickers.
  app.get('/', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { q = '', orgId, limit = 20 } = request.query as {
      q?: string; orgId?: string; limit?: number
    }

    const myOrgIds = (await prisma.orgMember.findMany({
      where: { userId: sub },
      select: { orgId: true },
    })).map((m) => m.orgId)

    const scopedOrgIds = orgId && myOrgIds.includes(orgId) ? [orgId] : myOrgIds
    if (scopedOrgIds.length === 0) return []

    return prisma.user.findMany({
      where: {
        orgs: { some: { orgId: { in: scopedOrgIds } } },
        ...(q ? {
          OR: [
            { name:       { contains: q } },
            { email:      { contains: q } },
            { department: { contains: q } },
            { group:      { contains: q } },
          ],
        } : {}),
      },
      select: PUBLIC_PROFILE_FIELDS,
      orderBy: { name: 'asc' },
      take: Math.min(Number(limit) || 20, 100),
    })
  })

  // Public profile — viewable by anyone in a shared org
  app.get('/:userId', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { userId } = request.params as { userId: string }

    if (userId !== sub) {
      const shared = await prisma.orgMember.findFirst({
        where: {
          userId,
          org: { members: { some: { userId: sub } } },
        },
      })
      if (!shared) return reply.code(404).send({ error: 'User not found' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_PROFILE_FIELDS,
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return user
  })

  // Update own profile
  app.patch('/me', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const body = ProfileUpdateSchema.parse(request.body)

    const user = await prisma.user.update({
      where: { id: sub },
      data: body,
      select: PUBLIC_PROFILE_FIELDS,
    })
    return reply.send(user)
  })
}
