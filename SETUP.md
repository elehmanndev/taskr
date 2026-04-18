# Taskr Setup Guide

This is the "I cloned the repo and have no idea what I'm looking at" guide. Read top-to-bottom the first time.

---

## Part 1: What is this thing?

Taskr is **two apps and two data stores** glued together:

```
┌──────────────────────────────────────────────────────────┐
│  Browser (you)                                           │
└────────────────────────┬─────────────────────────────────┘
                         │ https://taskr.elehmann.dev
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Cloudflare Tunnel  ← makes your Unraid box public       │
│                       without port forwarding            │
└────────────────────────┬─────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│  client  (Nginx, port 80)                                │
│    • Serves the React app                                │
│    • Forwards /api/*, /auth/*, /socket.io/* to server    │
└────────────────────────┬─────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│  server  (Node.js + Fastify, port 3001)                  │
│    • REST API, WebSockets, auth, automations             │
└──────┬───────────────────────────────────────┬───────────┘
       ▼                                       ▼
┌──────────────┐                    ┌────────────────────┐
│  MySQL       │                    │  Redis             │
│  (all data)  │                    │  (job queues)      │
└──────────────┘                    └────────────────────┘
```

All four run as Docker containers on Unraid. One `docker compose up -d` starts everything.

---

## Part 2: The Stack (for the curious)

| Piece | What it is | Why |
|---|---|---|
| **Node.js + Fastify** | Backend HTTP server | Fast, simple, TypeScript-native |
| **Prisma** | Database toolkit (ORM) | Type-safe SQL, auto-generates client code from the schema |
| **MySQL 8** | Database | Boring, reliable, easy to back up |
| **Redis** | In-memory store | Holds the job queue (so automations don't block API requests) |
| **BullMQ** | Queue library | Runs on top of Redis — processes automations, emails, cron jobs |
| **Socket.io** | WebSockets | Pushes live updates so two users see changes instantly |
| **React 18 + Vite** | Frontend framework + build tool | Vite is faster than webpack, nothing fancier than that |
| **Tailwind CSS** | Styling | Utility classes — no separate `.css` files |
| **Zustand** | React state management | Like Redux but without the boilerplate |
| **@dnd-kit** | Drag and drop | For dragging items between groups |
| **Resend** | Email sending API | Free 3k/mo tier |
| **Google OAuth** | Login | Users sign in with Google — no password to manage |
| **Nginx** | Web server | Serves the built React app + proxies API calls to Fastify |
| **Cloudflare Tunnel** | Public access | Makes `taskr.elehmann.dev` reach your Unraid box — no port forwarding, no firewall holes |
| **Docker Compose** | Container orchestrator | One file describes all 5 services + how they talk |

**What you DO NOT need to install manually:** MySQL, Redis, Node, Nginx — all of it runs inside Docker.

**What you DO need on the host (Unraid):** Docker + Docker Compose.

---

## Part 3: Folder Map

```
taskr/
├── CLAUDE.md           ← Spec + architecture notes (for Claude & you)
├── SETUP.md            ← This file
├── README.md           ← Short public intro
├── docker-compose.yml  ← Defines all 5 containers
├── .env.example        ← Template for secrets
├── .env                ← Your real secrets (NEVER commit this)
│
├── server/             ← The backend
│   ├── prisma/schema.prisma    ← Database shape. Change this → re-run db push
│   ├── src/
│   │   ├── index.ts            ← Fastify entry point
│   │   ├── routes/             ← /auth, /api/boards, /api/items, etc.
│   │   ├── services/           ← Automation engine
│   │   ├── workers/            ← Background jobs (BullMQ)
│   │   └── lib/                ← Prisma, Redis, Socket.io, email
│   └── Dockerfile
│
└── client/             ← The frontend
    ├── src/
    │   ├── main.tsx            ← Entry point
    │   ├── App.tsx             ← Router
    │   ├── pages/              ← Login, Dashboard, BoardPage, Profile
    │   ├── components/         ← UI building blocks
    │   ├── stores/             ← Zustand state (auth, board, notifications)
    │   └── lib/                ← API client, socket client, types
    ├── nginx.conf              ← Nginx config (baked into the Docker image)
    └── Dockerfile              ← Builds the React app, then serves via Nginx
```

---

## Part 4: First-Time Setup (Unraid, the real deploy)

### 4.0 Unraid prerequisites — verify before anything else

SSH into Unraid first:

```bash
ssh root@<your-unraid-ip>
```

Then run:

```bash
docker compose version
```

Expected output: `Docker Compose version v2.x.x` — if you see this, you're good.

If you get `command not found`: go to Unraid Community Apps → search **"Compose Manager"** → install it. Then re-run the check.

Also verify the appdata path exists (it will, this is standard Unraid):

```bash
ls /mnt/user/appdata
```

You should see a list of existing app folders. Taskr will live at `/mnt/user/appdata/taskr`.

---

**Note on existing Redis:** You already have a `/Redis` container running on Unraid for other apps. The Taskr compose file brings its own Redis container and maps it to port `6380` on the host (not `6379`), so there is no conflict. They run in separate Docker networks and never touch each other.

**Note on existing Cloudflare tunnel:** You already have a `Unraid-Cloudflared-Tunnel` container for other services. The new `taskr` tunnel is a completely separate tunnel with its own token, running inside the Taskr Docker network. No conflict.

---

### 4.1 Put the code on Unraid

The repo has no GitHub remote yet, so you can't `git clone` it. Use SCP to copy it from your laptop.

**On your laptop** (run in Git Bash or PowerShell from the parent folder of the taskr project):

```bash
scp -r taskr root@<your-unraid-ip>:/mnt/user/appdata/taskr
```

Replace `<your-unraid-ip>` with your Unraid server's local IP (find it in Unraid → Settings → Network, or check your router). The copy will take a minute — it's uploading all the source files.

**Verify on Unraid** (SSH in and run):

```bash
ls /mnt/user/appdata/taskr
```

You should see: `client/  server/  docker-compose.yml  .env.example  SETUP.md  CLAUDE.md`

---

**Optional but recommended:** Push the repo to your personal private GitHub so you can `git pull` updates to Unraid later instead of re-copying every time. This is a one-time setup — ask Claude to walk you through it when you're ready. Use your personal GitHub account, not the org GitLab.

### 4.2 Create Google OAuth credentials

1. Go to **https://console.cloud.google.com** → APIs & Services → Credentials.
2. Create OAuth 2.0 Client ID (Web application).
3. Add Authorized JavaScript origin: `https://taskr.elehmann.dev`
4. Add Authorized redirect URI: `https://taskr.elehmann.dev`
5. Copy the **Client ID** — you'll paste it into `.env` in a second.

### 4.3 Create a Cloudflare Tunnel

1. Go to **https://one.dash.cloudflare.com** → Networks → Tunnels → Create tunnel.
2. Give it a name (e.g. `taskr`). Copy the **tunnel token** it gives you.
3. Add a Public Hostname: `taskr.elehmann.dev` → `http://client:80`.
   (That `client:80` is the name of the nginx container. Cloudflare will reach it through the Docker network.)

### 4.4 Create a Resend account

1. Go to **https://resend.com**, sign up, verify your domain.
2. Copy the API key.

### 4.5 Generate secrets (on your laptop)

Run these in Git Bash (Windows) or any terminal with `openssl`:

```bash
openssl rand -hex 32   # → paste as JWT_SECRET
openssl rand -hex 16   # → paste as MYSQL_PASSWORD
openssl rand -hex 16   # → paste as MYSQL_ROOT_PASSWORD
```

Save all three outputs in a scratch note before continuing.

---

### 4.6 Fill in `.env` (on Unraid, via SSH)

```bash
cd /mnt/user/appdata/taskr
cp .env.example .env
nano .env
```

Fill in every field. Reference:

| Variable | Value |
|---|---|
| `JWT_SECRET` | output of `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | from Google Console (ends in `.apps.googleusercontent.com`) |
| `RESEND_API_KEY` | from Resend (starts with `re_`) |
| `EMAIL_FROM` | `Taskr <noreply@elehmann.dev>` |
| `CLIENT_URL` | `https://taskr.elehmann.dev` |
| `MYSQL_ROOT_PASSWORD` | output of `openssl rand -hex 16` |
| `MYSQL_PASSWORD` | output of `openssl rand -hex 16` |
| `DATABASE_URL` | `mysql://taskr:MYSQL_PASSWORD@localhost:3307/taskr` — replace `MYSQL_PASSWORD` with the actual value |
| `VITE_API_URL` | `https://taskr.elehmann.dev` |
| `VITE_GOOGLE_CLIENT_ID` | same as `GOOGLE_CLIENT_ID` |
| `CLOUDFLARE_TUNNEL_TOKEN` | token from Cloudflare tunnel setup |
| `DATA_PATH` | `/mnt/user/appdata/taskr` — uncomment this line |

Save and exit nano: `Ctrl+O` → Enter → `Ctrl+X`

Verify nothing is still `change-me`:

```bash
grep "change-me\|xxxxxxxxxxxx\|your-" /mnt/user/appdata/taskr/.env
```

If that command prints nothing, every field is filled in.

### 4.7 Start the stack

```bash
cd /mnt/user/appdata/taskr
docker compose up -d
```

Watch what happens:

```bash
docker compose logs -f server
```

**What you'll see in order:**
1. MySQL starts and initializes — takes ~20 seconds, you'll see "ready for connections"
2. Server starts — you'll see "Fastify server running on port 3001"
3. The `tunnel` container connects to Cloudflare — the tunnel status in the Cloudflare dashboard will flip from Inactive (orange) to Healthy (green)

Press `Ctrl+C` to stop watching logs (containers keep running).

**After the server is up, create the database tables:**

```bash
docker compose exec server npx prisma db push
```

Expected output ends with: `Your database is now in sync with your Prisma schema.`

If you see errors, run:

```bash
docker compose restart server
docker compose logs -f server
```

Then re-run `prisma db push`.

### 4.8 Seed yourself an org (one-time)

The app has no admin UI yet for creating the first org. Run this after tables exist:

```bash
docker compose exec server node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.org.create({
  data: {
    name: 'Viajesparati',
    slug: 'viajesparati',
  }
}).then(o => console.log('Created org:', o.id)).finally(() => prisma.\$disconnect());
"
```

Copy the org ID it prints — you'll need it to associate your Google login with the org after first sign-in.

### 4.9 Visit

Open **https://taskr.elehmann.dev**. Sign in with Google. Done.

---

## Part 5: Local Development (on your laptop)

For hot-reload while coding — this skips Docker for the app code but still uses Docker for MySQL + Redis.

```bash
# 1. Start only MySQL and Redis
docker compose up -d db redis

# 2. Backend (hot-reloads on file save)
cd server
npm install
npx prisma generate
npx prisma db push      # creates tables the first time; safe to re-run
npm run dev             # starts Fastify on :3001

# 3. Frontend (in a second terminal)
cd client
npm install
npm run dev             # starts Vite on :5173
```

Open **http://localhost:5173** — Vite proxies `/api`, `/auth`, and `/socket.io` to `:3001` automatically.

**Gotcha:** Google OAuth only accepts HTTPS redirect URIs in production. For local dev you have two options:
- Add a second OAuth Client in Google Console with `http://localhost:5173` as the origin, and put that Client ID into `VITE_GOOGLE_CLIENT_ID` in a `client/.env.local` file.
- Or use the tunnel in dev too — skip this, just test on the deployed site.

---

## Part 6: Common Tasks

### "I changed `schema.prisma`"

```bash
# Inside the server container (easiest):
docker compose exec server npx prisma db push
docker compose restart server

# OR locally against the dockerized DB:
cd server
npx prisma generate
npx prisma db push    # reads DATABASE_URL from .env
```

### "I want to see the database"

```bash
cd server
npx prisma studio     # opens a GUI at http://localhost:5555
```

### "Something's broken, where do I look?"

```bash
docker compose logs -f server     # Fastify + Prisma
docker compose logs -f client     # Nginx (usually silent)
docker compose logs -f db         # MySQL
docker compose logs -f redis
docker compose logs -f tunnel     # Cloudflare connection status
```

### "I want to nuke everything and start over"

```bash
docker compose down -v            # -v also deletes the MySQL + Redis volumes
rm -rf ./data                     # if DATA_PATH points here
docker compose up -d
```

### "Backup the database"

```bash
docker compose exec db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" taskr > backup.sql
```

### "Update to latest code"

```bash
git pull
docker compose build              # rebuild images
docker compose up -d              # recreate containers
docker compose exec server npx prisma db push    # if schema changed
```

---

## Part 7: Where Config Lives (and Who Reads What)

| File | Who reads it |
|---|---|
| `.env` | `docker-compose.yml` substitutes `${VARS}` into container environments |
| `docker-compose.yml` | The `docker compose` CLI |
| `server/prisma/schema.prisma` | Prisma — defines DB tables |
| `server/tsconfig.json` | TypeScript compiler for the server |
| `client/tsconfig.json` | TypeScript compiler for the client |
| `client/vite.config.ts` | Vite dev server + build |
| `client/tailwind.config.js` | Tailwind — scans your JSX for class names |
| `client/nginx.conf` | Nginx inside the `client` container |

The client reads env vars at **build time** (they get baked in), not runtime. That means if you change `VITE_API_URL` you have to rebuild the client image: `docker compose build client && docker compose up -d client`.

---

## Part 8: Gotchas / Things That Will Bite You

1. **Vite env vars must start with `VITE_`.** Anything else is silently ignored by the client.
2. **Prisma enum changes need `db push`.** Adding a new `ColumnType` value won't work until you push the schema.
3. **Don't use `@fastify/websocket`.** Socket.io is the sole WebSocket layer; adding fastify's websocket plugin will conflict.
4. **Nginx caches static assets for 30 days.** If a CSS/JS change isn't showing up, hard-reload (Ctrl+Shift+R) or bust via a new build.
5. **Cloudflare Tunnel has to reach `client:80` over the Docker network** — that's why the `tunnel` service is in the same compose file. It cannot be a standalone `cloudflared` install unless you switch the public hostname target to `http://host.docker.internal:3000`.
6. **MySQL port 3307, not 3306.** The `.env.example` maps the container's 3306 to host 3307 to avoid clashing with other Unraid MySQL containers.
7. **`npx prisma db push` in dev talks to localhost.** In the container it talks to the `db` service name. That's why `DATABASE_URL` differs — inside the container it's injected by `docker-compose.yml` (points at `db:3306`), outside you use the one in `.env` (points at `localhost:3307`).

---

## Part 9: Troubleshooting (Real Errors From First Deploy)

These are the exact errors encountered during the first Unraid deploy (2026-04-18), with fixes. If you hit one of these on a re-deploy, jump here.

### Server won't start — `libssl.so.1.1: No such file`
```
PrismaClientInitializationError: Unable to require(`libquery_engine-linux-musl.so.node`)
Error loading shared library libssl.so.1.1: No such file or directory
```
**Cause:** Prisma's Alpine Linux binary requires OpenSSL 1.1, which Alpine 3.20 dropped.
**Already fixed** in the repo: `server/Dockerfile` uses `node:20-slim` (Debian) + `apt-get install openssl`. If this regresses, do NOT switch back to `node:20-alpine`.

### Client shows "Missing VITE_GOOGLE_CLIENT_ID in environment"
**Cause:** Vite bakes env vars in at build time, not runtime. If you change `VITE_*` values in `.env`, `docker compose up -d` alone won't pick them up.
**Fix:** `docker compose build --no-cache client && docker compose up -d`. The repo's `docker-compose.yml` passes `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` through `build.args`.

### Tunnel logs show `Unauthorized: Invalid tunnel secret`
**Cause:** Wrong or corrupted `CLOUDFLARE_TUNNEL_TOKEN` in `.env`. Easy to grab the wrong string — Cloudflare shows both a tunnel UUID and a connector token. You need the **connector token** (long `eyJ...` base64 string from the "Install connector" page).
**Fix:** Re-copy from Cloudflare dashboard → Networks → Tunnels → click your tunnel → Configure → Install connector → copy the token (looks like `eyJhIjoi...`). Replace in `.env`, then `docker compose up -d --force-recreate tunnel`.

### `docker compose` warning: `CLOUDFLARE_TUNNEL_TOKEN variable is not set`
**Cause:** The line is missing from `.env` (or got deleted). Easy to miss because `.env.example` has the variable but placeholder value.
**Fix:** `grep CLOUDFLARE /mnt/user/appdata/taskr/.env` — should print the line. If empty, add it: `echo "CLOUDFLARE_TUNNEL_TOKEN=your-token-here" >> /mnt/user/appdata/taskr/.env`.

### `prisma db push` fails with `Container is restarting`
**Cause:** Server is in a crash loop — usually a code issue showing in `docker compose logs server`. `prisma db push` can't exec into a non-running container.
**Fix:** `docker compose logs server --tail=30` to see the real error. Fix that first.

### Port conflict on first `docker compose up -d`
Unraid already runs containers on common ports. **Confirmed conflicts as of 2026-04-18:**
- Port **3000** → `Nginx-Proxy-Manager-Official`
- Port **3001** → `mcphub`
- Port **6379** → existing `/Redis` container (Taskr uses 6380, no conflict)
**Fix:** In `.env`, set `CLIENT_PORT=3003` and `SERVER_PORT=3002` (or any other free host ports). Doesn't affect the app itself — Cloudflare Tunnel talks to `client:80` over the Docker network, not the host.

### First boot order matters
The correct sequence on a fresh deploy:
1. `docker compose up -d` — wait for MySQL healthcheck (~20s)
2. `docker compose exec server npx prisma db push` — creates tables
3. Seed org (SETUP.md §4.8)
4. Sign in via Google at https://taskr.elehmann.dev — creates your User
5. Attach your User to the org:
   ```bash
   docker compose exec server node -e "
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   (async () => {
     const users = await prisma.user.findMany();
     const user = users[0];
     await prisma.orgMember.create({
       data: { userId: user.id, orgId: 'YOUR_ORG_ID', role: 'OWNER' },
     });
     await prisma.\$disconnect();
   })();
   "
   ```

---

## Part 10: Future Stuff (Don't Worry About It Yet)

- **Hetzner VPS migration** — once the Unraid MVP is validated, we move to a real VPS on a Viajesparati subdomain.
- **Taskr MCP Server** — a Claude-facing wrapper around the REST API so you can manage boards from a chat interface. Design notes are in `CLAUDE.md` → "Future: Taskr MCP Server".

---

If something's still unclear, open `CLAUDE.md` and ask Claude — that file is the full architectural spec.
