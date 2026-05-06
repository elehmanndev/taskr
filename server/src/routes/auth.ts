import type { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../lib/prisma.js'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export async function authRoutes(app: FastifyInstance) {

  // Exchange Google ID token for our JWT (tighter rate limit: 10/min per IP)
  app.post('/google', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { idToken } = request.body as { idToken: string }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) return reply.code(400).send({ error: 'Invalid token' })

    // Match by email first so pre-seeded users (no googleId yet) link cleanly on first login.
    const existing = await prisma.user.findUnique({ where: { email: payload.email } })
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: payload.sub,
            name: payload.name ?? existing.name,
            avatarUrl: payload.picture ?? existing.avatarUrl,
          },
        })
      : await prisma.user.create({
          data: {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name ?? '',
            avatarUrl: payload.picture,
          },
        })

    // Auto-join any org that claims this email's domain.
    const domain = payload.email.split('@')[1]?.toLowerCase()
    if (domain) {
      const orgs = await prisma.org.findMany()
      const matching = orgs.filter(o => Array.isArray(o.emailDomains) && (o.emailDomains as string[]).map(d => d.toLowerCase()).includes(domain))
      for (const org of matching) {
        await prisma.orgMember.upsert({
          where: { orgId_userId: { orgId: org.id, userId: user.id } },
          create: { orgId: org.id, userId: user.id, role: 'MEMBER' },
          update: {},
        })
      }
    }

    const token = app.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '30d' }
    )

    reply
      .setCookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      .send({ user })
  })

  // Get current session user
  app.get('/me', { onRequest: [(app as any).authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    const user = await prisma.user.findUnique({
      where: { id: sub },
      include: {
        orgs: {
          include: { org: true },
        },
      },
    })
    return user
  })

  // Logout
  app.post('/logout', async (_, reply) => {
    reply
      .clearCookie('token', { path: '/' })
      .send({ ok: true })
  })

  // Dev-only: issue a JWT for a seeded test user without OAuth.
  // Returns 404 in production so the route never exists there.
  app.post('/dev-login', async (_, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'Not found' })
    }

    const email = 'dev@taskr.local'
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: 'Dev User' },
      update: {},
    })

    // Attach to the first org (if any) as OWNER for full access.
    const org = await prisma.org.findFirst({ orderBy: { createdAt: 'asc' } })
    if (org) {
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId: user.id } },
        create: { orgId: org.id, userId: user.id, role: 'OWNER' },
        update: { role: 'OWNER' },
      })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '30d' })

    reply
      .setCookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      .send({ user })
  })
}
