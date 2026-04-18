import { prisma } from '../lib/prisma.js'
import { actionQueue } from '../lib/queues.js'
import type { TriggerType } from '@prisma/client'

interface TriggerEvent {
  boardId: string
  triggerType: TriggerType
  itemId?: string
  payload: Record<string, any>
}

export async function evaluateAutomations(event: TriggerEvent) {
  const automations = await prisma.automation.findMany({
    where: {
      boardId: event.boardId,
      enabled: true,
      triggerType: event.triggerType,
    },
    include: { actions: { orderBy: { position: 'asc' } } },
  })

  for (const automation of automations) {
    const config = automation.triggerConfig as Record<string, any>
    const conditions = automation.conditions as any[]

    // ── Evaluate trigger config match ───────────────────────────────────────
    if (!matchesTrigger(event, config)) continue

    // ── Evaluate conditions ─────────────────────────────────────────────────
    if (conditions.length > 0) {
      const item = event.itemId
        ? await prisma.item.findUnique({ where: { id: event.itemId } })
        : null

      if (!evaluateConditions(conditions, item, event.payload)) continue
    }

    // ── Queue actions ───────────────────────────────────────────────────────
    const run = await prisma.automationRun.create({
      data: {
        automationId: automation.id,
        itemId: event.itemId,
        status: 'PENDING',
      },
    })

    for (const action of automation.actions) {
      await actionQueue.add('run-action', {
        runId: run.id,
        actionType: action.actionType,
        config: action.config,
        itemId: event.itemId,
        boardId: event.boardId,
        triggerPayload: event.payload,
      })
    }
  }
}

function matchesTrigger(event: TriggerEvent, config: Record<string, any>): boolean {
  switch (event.triggerType) {
    case 'STATUS_CHANGED':
    case 'COLUMN_CHANGED': {
      // Must match the specific column
      if (config.columnId && config.columnId !== event.payload.columnId) return false
      // Must match the target value (if specified)
      if (config.toValue !== undefined) {
        const newVal = event.payload.newValue
        const label = typeof newVal === 'object' ? newVal?.label : newVal
        if (label !== config.toValue) return false
      }
      return true
    }
    case 'ITEM_MOVED': {
      if (config.toGroupId && config.toGroupId !== event.payload.toGroupId) return false
      return true
    }
    case 'ITEM_CREATED':
    case 'EVERY_PERIOD':
    case 'DATE_ARRIVES':
    case 'DUE_DATE_APPROACHING':
    case 'ASSIGNEE_CHANGED':
      return true
    default:
      return false
  }
}

function evaluateConditions(
  conditions: any[],
  item: any,
  payload: Record<string, any>
): boolean {
  return conditions.every((cond) => {
    const colVals = item?.columnValues as Record<string, any> ?? {}
    const val = colVals[cond.columnId]

    switch (cond.operator) {
      case 'equals':    return val === cond.value
      case 'not_equals': return val !== cond.value
      case 'is_empty':  return val == null || val === ''
      case 'is_not_empty': return val != null && val !== ''
      default:          return true
    }
  })
}
