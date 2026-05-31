import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'

import { authRoutes } from './routes/auth.js'
import { orgRoutes } from './routes/orgs.js'
import { userRoutes } from './routes/users.js'
import { boardRoutes } from './routes/boards.js'
import { groupRoutes, commentRoutes } from './routes/groups.js'
import { itemRoutes } from './routes/items.js'
import { folderRoutes } from './routes/folders.js'
import { scheduleRoutes } from './routes/schedules.js'
import { automationRoutes, notificationRoutes } from './routes/automations.js'
import { initSocket } from './lib/socket.js'
import { startWorkers } from './workers/index.js'

// Fail fast if JWT_SECRET is missing or still the example placeholder
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-to-a-random-64-char-string') {
  console.error('FATAL: JWT_SECRET is not set or is the default value. Set a strong secret in .env')
  process.exit(1)
}

const app = Fastify({ logger: true })

// ── Plugins ──────────────────────────────────────────────────────────────────
await app.register(fastifyHelmet, {
  contentSecurityPolicy: false, // CSP handled by nginx / Cloudflare
})
await app.register(fastifyRateLimit, {
  max: 120,        // 120 req/min per IP globally
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({ error: 'Too many requests' }),
})
await app.register(fastifyCors, {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
})
await app.register(fastifyCookie)
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  cookie: { cookieName: 'token', signed: false },
})

// ── Global error handler ──────────────────────────────────────────────────────
app.setErrorHandler((error, _request, reply) => {
  const status = error.statusCode ?? 500
  if (status >= 500) {
    app.log.error(error)
    return reply.code(500).send({ error: 'Internal server error' })
  }
  return reply.code(status).send({ error: error.message })
})

// ── Auth decorator ────────────────────────────────────────────────────────────
app.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Unauthorized' })
  }
})

// ── Routes ────────────────────────────────────────────────────────────────────
await app.register(authRoutes,         { prefix: '/auth' })
await app.register(orgRoutes,          { prefix: '/api/orgs' })
await app.register(userRoutes,         { prefix: '/api/users' })
await app.register(boardRoutes,        { prefix: '/api/boards' })
await app.register(groupRoutes,        { prefix: '/api/boards/:boardId/groups' })
await app.register(itemRoutes,         { prefix: '/api/boards/:boardId/items' })
await app.register(commentRoutes,      { prefix: '/api/items/:itemId/comments' })
await app.register(folderRoutes,       { prefix: '/api/folders' })
await app.register(scheduleRoutes,     { prefix: '/api/schedules' })
await app.register(automationRoutes,   { prefix: '/api/boards/:boardId/automations' })
await app.register(notificationRoutes, { prefix: '/api/notifications' })

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

// ── Start ─────────────────────────────────────────────────────────────────────
await app.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' })

// Init Socket.io AFTER Fastify is listening (needs the http server)
initSocket(app)

// Start BullMQ workers
startWorkers()
