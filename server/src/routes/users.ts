import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const ProfileUpdateSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  avatarUrl:   z.string().url().nullable().optional(),
  title:       z.string().max(120).nullable().optional(),
  department:  z.string().max(120).nullable().optional(),
  bio:         z.string().max(4000).nullable().optional(),
  skills:      z.array(z.string().min(1).max(60)).max(50).optional(),
  expertise:   z.array(z.string().min(1).max(60)).max(50).optional(),
  phone:       z.string().max(40).nullable().optional(),
  timezone:    z.string().max(60).nullable().optional(),
  location:    z.string().max(120).nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  githubUrl:   z.string().url().nullable().optional(),
})

const PUBLIC_PROFILE_FIELDS = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  title: true,
  department: true,
  bio: true,
  skills: true,
  expertise: true,
  phone: true,
  timezone: true,
  location: true,
  linkedinUrl: true,
  githubUrl: true,
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
            { title:      { contains: q } },
            { department: { contains: q } },
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
