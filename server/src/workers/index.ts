import { Worker } from 'bullmq'
import { redis } from '../lib/queues.js'
import { prisma } from '../lib/prisma.js'
import { evaluateAutomations } from '../services/automationEngine.js'
import { sendEmail } from '../lib/email.js'
import { emitToBoard } from '../lib/socket.js'
import rrulePkg from 'rrule'
const { RRule } = rrulePkg

// ── Worker 1: Evaluate triggers ──────────────────────────────────────────────
const triggerWorker = new Worker(
  'automation-triggers',
  async (job) => {
    await evaluateAutomations(job.data)
  },
  { connection: redis }
)

// ── Worker 2: Run actions ────────────────────────────────────────────────────
const actionWorker = new Worker(
  'automation-actions',
  async (job) => {
    const { runId, actionType, config, itemId, boardId, triggerPayload } = job.data

    try {
      await runAction({ actionType, config, itemId, boardId, triggerPayload })

      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: 'SUCCESS', completedAt: new Date() },
      })
    } catch (err: any) {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: 'FAILED', error: err.message, completedAt: new Date() },
      })
      throw err
    }
  },
  { connection: redis }
)

// ── Worker 3: Time-based triggers (cron) ─────────────────────────────────────
const cronWorker = new Worker(
  'automation-cron',
  async () => {
    const now = new Date()

    // Every-period automations
    const due = await prisma.automation.findMany({
      where: {
        enabled: true,
        triggerType: 'EVERY_PERIOD',
        nextRunAt: { lte: now },
      },
      include: { actions: { orderBy: { position: 'asc' } } },
    })

    for (const auto of due) {
      const config = auto.triggerConfig as any

      await evaluateAutomations({
        boardId: auto.boardId,
        triggerType: 'EVERY_PERIOD',
        payload: { automationId: auto.id },
      })

      // Compute next run
      const rule = RRule.fromString(config.rrule)
      const next = rule.after(now)
      await prisma.automation.update({
        where: { id: auto.id },
        data: { nextRunAt: next },
      })
    }

    // Due date approaching (check items with due dates in next 24h)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const dueSoonItems = await prisma.item.findMany({
      where: {
        columnValues: { path: '$.date', gte: now.toISOString().split('T')[0] } as any,
      },
      take: 500,
    })

    // (simplified — in production: query by parsed date column)
    for (const item of dueSoonItems) {
      await evaluateAutomations({
        boardId: item.boardId,
        triggerType: 'DUE_DATE_APPROACHING',
        itemId: item.id,
        payload: { item },
      })
    }
  },
  { connection: redis }
)

// ── Action implementations ────────────────────────────────────────────────────
async function runAction({
  actionType,
  config,
  itemId,
  boardId,
  triggerPayload,
}: any) {
  switch (actionType) {

    case 'NOTIFY_PERSON': {
      const { userId, message } = config
      const item = itemId ? await prisma.item.findUnique({ where: { id: itemId } }) : null

      await prisma.notification.create({
        data: {
          userId,
          type: 'AUTOMATION_TRIGGERED',
          title: message || 'Automation triggered',
          body: item ? `On item: ${item.name}` : undefined,
          entityId: itemId,
        },
      })

      // Push via socket
      emitToBoard(boardId, 'notification:new', { userId })
      break
    }

    case 'NOTIFY_ASSIGNEES': {
      if (!itemId) break
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: { assignees: { include: { user: true } } },
      })
      if (!item) break

      for (const assignee of item.assignees) {
        await prisma.notification.create({
          data: {
            userId: assignee.userId,
            type: 'AUTOMATION_TRIGGERED',
            title: config.message || `Update on: ${item.name}`,
            entityId: itemId,
          },
        })
      }
      break
    }

    case 'SEND_EMAIL': {
      const { to, subject, body } = config
      await sendEmail({ to, subject, html: body })
      break
    }

    case 'CHANGE_STATUS':
    case 'CHANGE_COLUMN_VALUE': {
      if (!itemId) break
      const item = await prisma.item.findUnique({ where: { id: itemId } })
      if (!item) break

      const colVals = item.columnValues as Record<string, any>
      colVals[config.columnId] = config.value

      const updated = await prisma.item.update({
        where: { id: itemId },
        data: { columnValues: colVals },
      })
      emitToBoard(boardId, 'item:updated', updated)
      break
    }

    case 'MOVE_TO_GROUP': {
      if (!itemId) break
      const updated = await prisma.item.update({
        where: { id: itemId },
        data: { groupId: config.groupId },
      })
      emitToBoard(boardId, 'item:updated', updated)
      break
    }

    case 'ASSIGN_PERSON': {
      if (!itemId) break
      await prisma.itemAssignee.upsert({
        where: { itemId_userId: { itemId, userId: config.userId } },
        create: { itemId, userId: config.userId },
        update: {},
      })
      emitToBoard(boardId, 'item:updated', { id: itemId })
      break
    }

    case 'CREATE_ITEM': {
      const group = await prisma.group.findFirst({
        where: { boardId, name: config.groupName ?? 'To Do' },
      })
      if (!group) break
      const newItem = await prisma.item.create({
        data: {
          boardId,
          groupId: group.id,
          name: config.name || 'New Item',
          columnValues: config.columnValues ?? {},
          position: 0,
        },
      })
      emitToBoard(boardId, 'item:created', newItem)
      break
    }

    default:
      console.warn(`Unknown action type: ${actionType}`)
  }
}

export function startWorkers() {
  console.log('✅ Workers started')

  triggerWorker.on('failed', (job, err) =>
    console.error(`Trigger job ${job?.id} failed:`, err.message)
  )
  actionWorker.on('failed', (job, err) =>
    console.error(`Action job ${job?.id} failed:`, err.message)
  )

  // Schedule cron worker to run every minute
  import('bullmq').then(({ Queue }) => {
    const cronQueue = new Queue('automation-cron', { connection: redis })
    cronQueue.add('tick', {}, {
      repeat: { every: 60_000 },
      removeOnComplete: true,
    })
  })
}
