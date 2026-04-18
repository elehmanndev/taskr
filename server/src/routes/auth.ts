import type { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../lib/prisma.js'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export async function authRoutes(app: FastifyInstance) {

  // Exchange Google ID token for our JWT
  app.post('/google', async (request, reply) => {
    const { idToken } = request.body as { idToken: string }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload?.email) return reply.code(400).send({ error: 'Invalid token' })

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        name: payload.name ?? '',
        avatarUrl: payload.picture,
        email: payload.email,
      },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? '',
        avatarUrl: payload.picture,
      },
    })

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
}
