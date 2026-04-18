import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma.js'

type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'

function sub(request: FastifyRequest): string {
  return (request.user as { sub: string }).sub
}

async function orgMembership(userId: string, orgId: string) {
  return prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { role: true },
  })
}

async function canAccessBoard(userId: string, boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, orgId: true, kind: true },
  })
  if (!board) return { ok: false as const, reason: 'not_found' as const }

  const member = await orgMembership(userId, board.orgId)
  if (!member) return { ok: false as const, reason: 'forbidden' as const }

  if (board.kind === 'PRIVATE') {
    const bm = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId: board.id, userId } },
      select: { role: true },
    })
    if (!bm) return { ok: false as const, reason: 'forbidden' as const }
  }

  return { ok: true as const, board }
}

function deny(reply: FastifyReply, reason: 'not_found' | 'forbidden') {
  if (reason === 'not_found') return reply.code(404).send({ error: 'Not found' })
  return reply.code(403).send({ error: 'Forbidden' })
}

// ── Guards ───────────────────────────────────────────────────────────────────

export function requireOrgMember(opts: { from: 'params' | 'query'; key?: string } = { from: 'params', key: 'orgId' }) {
  const key = opts.key ?? 'orgId'
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const bag = (opts.from === 'query' ? request.query : request.params) as Record<string, string>
    const orgId = bag?.[key]
    if (!orgId) return reply.code(400).send({ error: `Missing ${key}` })
    const member = await orgMembership(sub(request), orgId)
    if (!member) return reply.code(403).send({ error: 'Forbidden' })
    ;(request as any).orgRole = member.role as Role
  }
}

export function requireOrgAdmin(opts: { from: 'params' | 'query'; key?: string } = { from: 'params', key: 'orgId' }) {
  const key = opts.key ?? 'orgId'
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const bag = (opts.from === 'query' ? request.query : request.params) as Record<string, string>
    const orgId = bag?.[key]
    if (!orgId) return reply.code(400).send({ error: `Missing ${key}` })
    const member = await orgMembership(sub(request), orgId)
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    ;(request as any).orgRole = member.role as Role
  }
}

export async function requireBoardAccess(request: FastifyRequest, reply: FastifyReply) {
  const { boardId } = request.params as { boardId: string }
  if (!boardId) return reply.code(400).send({ error: 'Missing boardId' })
  const res = await canAccessBoard(sub(request), boardId)
  if (!res.ok) return deny(reply, res.reason)
  ;(request as any).board = res.board
}

export async function requireItemAccess(request: FastifyRequest, reply: FastifyReply) {
  const { itemId } = request.params as { itemId: string }
  if (!itemId) return reply.code(400).send({ error: 'Missing itemId' })
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, boardId: true },
  })
  if (!item) return reply.code(404).send({ error: 'Not found' })
  const res = await canAccessBoard(sub(request), item.boardId)
  if (!res.ok) return deny(reply, res.reason)
  ;(request as any).item = item
  ;(request as any).board = res.board
}

export async function requireGroupAccess(request: FastifyRequest, reply: FastifyReply) {
  const { groupId } = request.params as { groupId: string }
  if (!groupId) return reply.code(400).send({ error: 'Missing groupId' })
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, boardId: true },
  })
  if (!group) return reply.code(404).send({ error: 'Not found' })
  const res = await canAccessBoard(sub(request), group.boardId)
  if (!res.ok) return deny(reply, res.reason)
  ;(request as any).group = group
  ;(request as any).board = res.board
}

export async function requireAutomationAccess(request: FastifyRequest, reply: FastifyReply) {
  const { automationId } = request.params as { automationId: string }
  if (!automationId) return reply.code(400).send({ error: 'Missing automationId' })
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    select: { id: true, boardId: true },
  })
  if (!automation) return reply.code(404).send({ error: 'Not found' })
  const res = await canAccessBoard(sub(request), automation.boardId)
  if (!res.ok) return deny(reply, res.reason)
  ;(request as any).automation = automation
  ;(request as any).board = res.board
}

export async function requireFolderAccess(request: FastifyRequest, reply: FastifyReply) {
  const { folderId } = request.params as { folderId: string }
  if (!folderId) return reply.code(400).send({ error: 'Missing folderId' })
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, workspaceId: true, workspace: { select: { orgId: true } } },
  })
  if (!folder) return reply.code(404).send({ error: 'Not found' })
  const member = await orgMembership(sub(request), folder.workspace.orgId)
  if (!member) return reply.code(403).send({ error: 'Forbidden' })
  ;(request as any).folder = folder
}

export async function requireCommentOwner(request: FastifyRequest, reply: FastifyReply) {
  const { commentId } = request.params as { commentId: string }
  if (!commentId) return reply.code(400).send({ error: 'Missing commentId' })
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, itemId: true, userId: true },
  })
  if (!comment) return reply.code(404).send({ error: 'Not found' })
  if (comment.userId !== sub(request)) return reply.code(403).send({ error: 'Forbidden' })
  ;(request as any).comment = comment
}

// For POST/GET on /api/items/:itemId/comments — verify access to item
export async function requireItemAccessForComment(request: FastifyRequest, reply: FastifyReply) {
  const { itemId } = request.params as { itemId: string }
  if (!itemId) return reply.code(400).send({ error: 'Missing itemId' })
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, boardId: true },
  })
  if (!item) return reply.code(404).send({ error: 'Not found' })
  const res = await canAccessBoard(sub(request), item.boardId)
  if (!res.ok) return deny(reply, res.reason)
  ;(request as any).item = item
  ;(request as any).board = res.board
}

export async function requireWorkspaceAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, orgId: true },
  })
  if (!ws) return reply.code(404).send({ error: 'Not found' })
  const member = await orgMembership(sub(request), ws.orgId)
  if (!member) return reply.code(403).send({ error: 'Forbidden' })
  return ws
}
