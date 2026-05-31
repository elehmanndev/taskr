import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Throws 403 if the user isn't a member of the org. */
async function assertOrgMember(userId: string, orgId: string) {
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  })
  if (!member) {
    const err: any = new Error('Not a member of this organization')
    err.statusCode = 403
    throw err
  }
}

/** "YYYY-MM-DD" → a UTC midnight Date (matches @db.Date storage). */
function parseDate(s: string): Date {
  const d = new Date(`${s}T00:00:00.000Z`)
  if (isNaN(d.getTime())) {
    const err: any = new Error(`Invalid date: ${s}`)
    err.statusCode = 400
    throw err
  }
  return d
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Seeded when a department has no templates yet — the 8 recurring Booking time-bands,
// reverse-engineered across all 12 months of HORARIOS BOOKING 2026 (no seasonal variation:
// Jul/Aug match Dec). The ±30min end tweaks, recuperation hours and one-off personal shifts
// (e.g. Reinier's 10:14–17:21) are handled per-assignment via customSegments, not templates.
const DEFAULT_TEMPLATES = [
  { label: 'Mañana 1',       color: '#00C875', segments: [{ start: '08:00', end: '13:00' }, { start: '13:30', end: '16:30' }] },
  { label: 'Mañana 2',       color: '#9CD326', segments: [{ start: '09:00', end: '14:00' }, { start: '14:30', end: '17:30' }] },
  { label: 'Tarde',          color: '#FDAB3D', segments: [{ start: '13:30', end: '17:00' }, { start: '17:30', end: '22:00' }] },
  { label: 'Cierre',         color: '#FF642E', segments: [{ start: '16:00', end: '20:00' }, { start: '20:30', end: '24:00' }] },
  { label: 'Nocturno',       color: '#5559DF', segments: [{ start: '23:59', end: '07:59' }], crossesMidnight: true },
  { label: 'Seguida tarde',  color: '#A25DDC', segments: [{ start: '14:00', end: '21:00' }] },
  { label: 'Tarde corta',    color: '#68A1BD', segments: [{ start: '11:00', end: '17:00' }, { start: '17:30', end: '19:30' }] },
  { label: 'Continuo',       color: '#808080', segments: [{ start: '09:30', end: '15:30' }] },
]

// ── Schemas ──────────────────────────────────────────────────────────────────────

const SegmentSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end:   z.string().regex(/^\d{2}:\d{2}$/),
})

const TemplateCreateSchema = z.object({
  orgId:           z.string(),
  department:      z.string().min(1).max(120),
  label:           z.string().min(1).max(80),
  color:           z.string().max(40).optional(),
  segments:        z.array(SegmentSchema).max(6).default([]),
  crossesMidnight: z.boolean().optional(),
})

const AssignmentSchema = z.object({
  orgId:      z.string(),
  userId:     z.string(),
  date:       z.string().regex(DATE_RE),
  templateId: z.string().nullable().optional(),
  role:       z.string().max(60).nullable().optional(),
  note:       z.string().max(200).nullable().optional(),
  status:     z.enum(['WORKING', 'OFF', 'VACATION', 'SICK']).optional(),
})

// ── Routes ─────────────────────────────────────────────────────────────────────

export async function scheduleRoutes(app: FastifyInstance) {
  const auth = { onRequest: [(app as any).authenticate] }

  // Distinct departments in an org (drives the Horarios department picker).
  app.get('/departments', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { orgId } = request.query as { orgId?: string }
    if (!orgId) return []
    await assertOrgMember(sub, orgId)

    const rows = await prisma.user.findMany({
      where: { orgs: { some: { orgId } }, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    })
    return rows.map((r) => r.department).filter(Boolean)
  })

  // List shift templates for a department.
  app.get('/templates', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { orgId, department } = request.query as { orgId?: string; department?: string }
    if (!orgId || !department) return []
    await assertOrgMember(sub, orgId)

    return prisma.shiftTemplate.findMany({
      where: { orgId, department },
      orderBy: { position: 'asc' },
    })
  })

  // Create a shift template.
  app.post('/templates', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const body = TemplateCreateSchema.parse(request.body)
    await assertOrgMember(sub, body.orgId)

    const count = await prisma.shiftTemplate.count({
      where: { orgId: body.orgId, department: body.department },
    })
    return prisma.shiftTemplate.create({
      data: {
        orgId:           body.orgId,
        department:      body.department,
        label:           body.label,
        color:           body.color ?? '#0073EA',
        segments:        body.segments,
        crossesMidnight: body.crossesMidnight ?? false,
        position:        count,
      },
    })
  })

  // Seed the default time-bands for a department that has none yet.
  app.post('/templates/seed-defaults', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { orgId, department } = z
      .object({ orgId: z.string(), department: z.string().min(1) })
      .parse(request.body)
    await assertOrgMember(sub, orgId)

    const existing = await prisma.shiftTemplate.count({ where: { orgId, department } })
    if (existing > 0) return reply.code(409).send({ error: 'Department already has templates' })

    await prisma.shiftTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t, i) => ({
        orgId,
        department,
        label:           t.label,
        color:           t.color,
        segments:        t.segments,
        crossesMidnight: t.crossesMidnight ?? false,
        position:        i,
      })),
    })
    return prisma.shiftTemplate.findMany({ where: { orgId, department }, orderBy: { position: 'asc' } })
  })

  app.delete('/templates/:id', auth, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params as { id: string }
    const tpl = await prisma.shiftTemplate.findUnique({ where: { id } })
    if (!tpl) return reply.code(404).send({ error: 'Template not found' })
    await assertOrgMember(sub, tpl.orgId)
    await prisma.shiftTemplate.delete({ where: { id } })
    return { ok: true }
  })

  // The roster: people in a department + their assignments over a date range + the templates.
  app.get('/roster', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { orgId, department, from, to } = request.query as {
      orgId?: string; department?: string; from?: string; to?: string
    }
    if (!orgId || !department || !from || !to) {
      const err: any = new Error('orgId, department, from and to are required')
      err.statusCode = 400
      throw err
    }
    await assertOrgMember(sub, orgId)

    const [users, templates, assignments] = await Promise.all([
      prisma.user.findMany({
        where: { orgs: { some: { orgId } }, department },
        select: { id: true, name: true, avatarUrl: true, languages: true, group: true },
        orderBy: { name: 'asc' },
      }),
      prisma.shiftTemplate.findMany({ where: { orgId, department }, orderBy: { position: 'asc' } }),
      prisma.shiftAssignment.findMany({
        where: {
          date: { gte: parseDate(from), lte: parseDate(to) },
          user: { orgs: { some: { orgId } }, department },
        },
      }),
    ])

    return { users, templates, assignments }
  })

  // Upsert a single person/day assignment. WORKING needs a templateId; other statuses clear it.
  app.put('/assignments', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const body = AssignmentSchema.parse(request.body)
    await assertOrgMember(sub, body.orgId)

    const status = body.status ?? 'WORKING'
    const templateId = status === 'WORKING' ? body.templateId ?? null : null
    const date = parseDate(body.date)

    return prisma.shiftAssignment.upsert({
      where: { userId_date: { userId: body.userId, date } },
      create: { userId: body.userId, date, templateId, role: body.role ?? null, note: body.note ?? null, status },
      update: { templateId, role: body.role ?? null, note: body.note ?? null, status },
    })
  })

  // Clear an assignment (back to "no shift set").
  app.delete('/assignments', auth, async (request) => {
    const { sub } = request.user as { sub: string }
    const { orgId, userId, date } = request.query as { orgId?: string; userId?: string; date?: string }
    if (!orgId || !userId || !date || !DATE_RE.test(date)) {
      const err: any = new Error('orgId, userId and date (YYYY-MM-DD) are required')
      err.statusCode = 400
      throw err
    }
    await assertOrgMember(sub, orgId)
    await prisma.shiftAssignment.deleteMany({ where: { userId, date: parseDate(date) } })
    return { ok: true }
  })
}
