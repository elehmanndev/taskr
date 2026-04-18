# Taskr

Open-source, self-hosted project management tool. Monday.com alternative.

## Features

- Multi-tenant orgs with Google OAuth
- Boards with customizable columns (status, people, date, timeline, text, numbers, tags, dropdown, URL, and more)
- Drag-and-drop items between groups
- Real-time collaboration via WebSockets
- Automation engine (trigger → condition → action)
- Email notifications via Resend
- Recurring automations with RRULE support
- Comments with @mentions and replies
- Docker Compose for self-hosting

## Quick Start

```bash
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, JWT_SECRET, RESEND_API_KEY, CLOUDFLARE_TUNNEL_TOKEN
docker compose up -d
```

See **[SETUP.md](SETUP.md)** for the full walkthrough — stack explanation, local-dev workflow, common tasks, and gotchas.

## Tech Stack

Node.js · Fastify · Prisma · MySQL · React · Vite · Tailwind · BullMQ · Redis · Socket.io · Nginx · Cloudflare Tunnel

## License

MIT
