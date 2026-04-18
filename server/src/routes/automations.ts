import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import rrulePkg from 'rrule'
const { RRule } = rrulePkg

export async function notificationRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.get('/', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { limit = 30, unreadOnly } = request.query as any

    return prisma.notification.findMany({
      where: {
        userId: sub,
        ...(unreadOnly === 'true' && { readAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    })
  })

  // Mark as read
  app.post('/read', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { ids } = request.body as { ids?: string[] }

    if (ids?.length) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: sub },
        data: { readAt: new Date() },
      })
    } else {
      // Mark all read
      await prisma.notification.updateMany({
        where: { userId: sub, readAt: null },
        data: { readAt: new Date() },
      })
    }
    return { ok: true }
  })

  app.get('/unread-count', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const count = await prisma.notification.count({
      where: { userId: sub, readAt: null },
    })
    return { count }
  })
}

// ── Automations ───────────────────────────────────────────────────────────────

export async function automationRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  app.get('/', auth, async (request) => {
    const { boardId } = request.params as { boardId: string }
    return prisma.automation.findMany({
      where: { boardId },
      include: { actions: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    })
  })

  app.post('/', auth, async (request, reply) => {
    const { boardId } = request.params as { boardId: string }
    const { sub } = request.user as { sub: string }
    const { name, triggerType, triggerConfig, conditions, actions } = request.body as any

    // Compute initial nextRunAt for time-based triggers
    let nextRunAt: Date | undefined
    if (triggerType === 'EVERY_PERIOD' && triggerConfig?.rrule) {
      const rule = RRule.fromString(triggerConfig.rrule)
      nextRunAt = rule.after(new Date()) ?? undefined
    }

    const automation = await prisma.automation.create({
      data: {
        boardId,
        createdById: sub,
        name,
        triggerType,
        triggerConfig: triggerConfig ?? {},
        conditions: conditions ?? [],
        nextRunAt,
        actions: {
          create: actions.map((a: any, i: number) => ({
            position: i,
            actionType: a.actionType,
            config: a.config ?? {},
          })),
        },
      },
      include: { actions: true },
    })

    return reply.code(201).send(automation)
  })

  app.patch('/:automationId', auth, async (request) => {
    const { automationId } = request.params as { automationId: string }
    const { enabled, name } = request.body as any

    return prisma.automation.update({
      where: { id: automationId },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(name    !== undefined && { name }),
      },
      include: { actions: true },
    })
  })

  app.delete('/:automationId', auth, async (request, reply) => {
    const { automationId } = request.params as { automationId: string }
    await prisma.automation.delete({ where: { id: automationId } })
    return reply.code(204).send()
  })

  // Run history
  app.get('/:automationId/runs', auth, async (request) => {
    const { automationId } = request.params as { automationId: string }
    return prisma.automationRun.findMany({
      where: { automationId },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
    })
  })
}
