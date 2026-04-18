# Taskr — Monday.com Clone

## What This Is

Open-source, self-hosted project management tool modeled after Monday.com. Multi-tenant, real-time, with an automation engine. Built for orgs of up to 250 users. Goal: replace Monday.com at Viajesparati (a travel company) and release as public GitHub repo.

## Deployment Target

**MVP:** Unraid server at home, exposed via Cloudflare Tunnel to `taskr.elehmann.dev`. No port forwarding, no exposed IP. All services run as Docker containers via Docker Compose.

**Production (later):** Hetzner VPS on a Viajesparati subdomain, once the MVP is validated.

## Tech Stack

- **Backend:** Node.js + Fastify + Prisma ORM + MySQL
- **Auth:** Google OAuth 2.0 + JWT (httpOnly cookie)
- **Queue:** BullMQ + Redis (automations, email, cron)
- **Email:** Resend (free tier: 3k/mo)
- **Frontend:** React 18 + Vite + Tailwind CSS + @dnd-kit + Zustand
- **Realtime:** Socket.io (one room per board, attached to Fastify's http server)
- **Serve:** Nginx (serves built React app + proxies /api, /auth, /socket.io to backend)
- **Infra:** Docker Compose (MySQL + Redis + server + client + Cloudflare tunnel)

**NOTE:** Viajesparati's existing stack is PHP/Laravel. This project is intentionally a separate standalone service — it does NOT integrate into or depend on the Laravel codebase.

## Project Structure

```
/server
  /prisma            schema.prisma (COMPLETE — all models defined)
  /src
    /routes          auth.ts, boards.ts, groups.ts (includes comments), items.ts,
                     automations.ts (includes notifications), orgs.ts
    /services        automationEngine.ts (trigger evaluator + condition matching)
    /workers         index.ts (BullMQ workers: trigger, action runner, cron)
    /lib             prisma.ts, redis.ts (unused — redis is in queues), queues.ts,
                     socket.ts, email.ts
    /middleware       (needs: orgGuard, boardAccessGuard)
    index.ts         Fastify app entry point
  Dockerfile
  package.json
  tsconfig.json

/client
  /src
    /components
      /board         BoardView, GroupRow, ItemRow, ColumnHeader
      /item          ItemDetailPanel, CommentThread
      /columns       StatusPill, PeoplePicker, DatePicker, TimelinePicker, etc.
      /ui            Button, Modal, Dropdown, Input, Badge, Avatar
      /layout        Sidebar, Navbar, NotificationBell
    /pages           Login, Dashboard, BoardPage, OrgSettings
    /hooks           useBoard, useItems, useSocket, useAuth, useNotifications
    /stores          authStore, boardStore, notificationStore (Zustand)
    /lib             api.ts (fetch wrapper), socket.ts (socket.io client)
  Dockerfile         (multi-stage: node build → nginx serve)
  nginx.conf         SPA fallback + /api proxy + /socket.io websocket upgrade
  package.json

docker-compose.yml   MySQL + Redis + server + client + Cloudflare tunnel
.env.example         All config with Unraid-specific defaults
```

## Architecture Notes

### Socket.io setup
- Socket.io `Server` is attached to Fastify's underlying http server AFTER `app.listen()`.
- Do NOT use `@fastify/websocket` — it conflicts with socket.io. Socket.io is the sole websocket layer.
- `initSocket(app)` must be called in `index.ts` after `app.listen()`.
- Nginx proxies `/socket.io/` with websocket upgrade headers.

### Nginx as single entry point
- Client Nginx serves the React SPA on port 80 inside the container.
- All `/api/*`, `/auth/*`, `/health`, and `/socket.io/*` requests are proxied to the `server` container on port 3001.
- Cloudflare Tunnel points `taskr.elehmann.dev` → `http://client:80`.
- This means the client's VITE_API_URL should be the same domain (e.g. `https://taskr.elehmann.dev`) — the nginx proxy handles routing.

### Google OAuth with Cloudflare Tunnel
- Google OAuth requires HTTPS + a real domain for redirect URLs.
- Cloudflare Tunnel provides this for free — no certificates to manage.
- Google Console authorized redirect URI: `https://taskr.elehmann.dev/auth/google/callback`
- The frontend uses Google Identity Services (Sign In With Google button) to get an ID token, then posts it to `/auth/google`.

## Data Model (Prisma — already scaffolded)

### Hierarchy
```
Org → Workspace → Folder? → Board → Group → Item
                            Board → Column (schema definition)
                            Item  → Comment, Attachment, ItemAssignee
                            Board → Automation → AutomationAction
```

Folders are **optional** — boards can live directly in a workspace (`folderId = null`) or inside a folder. When a folder is deleted its boards move back to the workspace root (not deleted).

### Key Design Decisions
- **Multi-tenant:** Every query scoped by `orgId`. OrgMember table controls access.
- **Column values are JSON:** `Item.columnValues` stores `{ columnId: value }`. Columns table defines schema (type, settings, labels).
- **Status + Priority are both `STATUS` type columns** — just different label sets. Not first-class fields.
- **No subitems in V1.** Planned for later.
- **Timeline** = two dates: stored as `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` in columnValues.
- **Automations** = Trigger → Conditions → Actions pipeline. BullMQ processes everything async.
- **Attachments** = URL and text only. No file uploads in V1.
- **Comments** = Day one. Text body, replies, @mentions stored as JSON refs.
- **User profiles** = Rich. Beyond name/email/avatar, Users have `title`, `department`, `bio`, `skills[]`, `expertise[]`, `phone`, `timezone`, `location`, `linkedinUrl`, `githubUrl`. Profiles are viewable by anyone sharing an org, editable only by self. Clicking any avatar opens a ProfilePopover card; `/users/:id` shows the full page.

### Column Types (V1)
STATUS, PEOPLE, DATE, TIMELINE, TEXT, NUMBERS, DROPDOWN, TAGS, URL, LONG_TEXT, CHECKBOX, RATING, PROGRESS, TIME_TRACKING, CREATION_LOG, LAST_UPDATED, EMAIL, PHONE, LINK, FILE

`LINK` and `FILE` both store `{ url, label? }` in columnValues. `FILE` in V1 is a URL pointer only (no uploads) — same shape as `LINK`, kept as a separate type so upload behavior can be added later without a migration.

### Status Column Settings Shape
```json
{
  "labels": [
    { "id": 0, "label": "To Do", "color": "working_orange", "index": 0, "is_done": false },
    { "id": 1, "label": "In Progress", "color": "bright_blue", "index": 1, "is_done": false },
    { "id": 2, "label": "Done", "color": "done_green", "index": 2, "is_done": true }
  ]
}
```

Monday.com color palette: working_orange, done_green, stuck_red, dark_blue, purple, explosive, grass_green, bright_blue, saladish, egg_yolk, blackish, dark_red, sofia_pink, lipstick, dark_purple, bright_green, chili_blue, american_gray, brown, dark_orange, sunset, bubble, peach, berry, winter, river, navy, aquamarine, indigo

## Automation Engine

### Trigger Types
STATUS_CHANGED, DATE_ARRIVES, ITEM_CREATED, ITEM_MOVED, COLUMN_CHANGED, ASSIGNEE_CHANGED, EVERY_PERIOD, DUE_DATE_APPROACHING

### Action Types
NOTIFY_PERSON, NOTIFY_ASSIGNEES, SEND_EMAIL, CHANGE_STATUS, CHANGE_COLUMN_VALUE, MOVE_TO_GROUP, ASSIGN_PERSON, CREATE_ITEM, DELETE_ITEM, SET_DATE

### Flow
1. Item mutation triggers an event in route handler
2. Event goes to `automation-triggers` BullMQ queue
3. `automationEngine.ts` evaluates matching automations for that board
4. Matching actions go to `automation-actions` queue
5. Worker executes actions (notify, email, update item, etc.)
6. Cron worker (every 60s) handles `EVERY_PERIOD` and `DATE_ARRIVES` triggers

### Recurrence
Uses iCalendar RRULE strings via `rrule` npm package. Stored in `triggerConfig.rrule`. Cron worker computes `nextRunAt` after each execution.

## Realtime

Socket.io with board-level rooms. Every mutation in routes calls `emitToBoard(boardId, event, data)`.

Events: `item:created`, `item:updated`, `item:deleted`, `items:reordered`, `group:created`, `group:updated`, `group:deleted`, `board:updated`, `comment:created`, `notification:new`, `presence:update`, `presence:offline`

## What's Done

- [x] Full Prisma schema (all models, enums, relations)
- [x] Server entry point with correct plugin/socket wiring
- [x] Auth (Google OAuth token exchange + JWT)
- [x] Boards CRUD with default columns + groups on create
- [x] Items CRUD with automation trigger firing + column change detection
- [x] Groups CRUD
- [x] Comments with replies + mentions + notifications
- [x] Notifications + unread count + mark read
- [x] Automations CRUD + run history
- [x] Automation engine (evaluator + condition matcher)
- [x] 3 BullMQ workers (triggers, actions, cron)
- [x] Socket.io lib with board rooms + presence
- [x] Email lib with Resend + templates (assigned, due date)
- [x] Docker Compose (MySQL + Redis + server + client + Cloudflare tunnel)
- [x] Client Dockerfile (multi-stage: vite build → nginx)
- [x] Nginx config (SPA + API proxy + WebSocket upgrade)
- [x] Orgs CRUD with member invite/remove

## What Needs Building

### Server (remaining)
- [ ] Org access middleware (verify user belongs to org on all /api routes)
- [ ] Board access middleware (verify user can access board — public or member)
- [ ] Columns CRUD route (add/remove/reorder/update settings on a board)
- [ ] Webhooks route (outbound webhooks to external URLs)
- [ ] Workspace CRUD route
- [ ] Item assignee management (add/remove assignees endpoint)
- [ ] Attachment CRUD route (URL/text only, no file upload)
- [ ] Board member management route (add/remove/change role)
- [ ] Input validation with Zod on all routes (schemas exist for boards, need others)
- [ ] Error handling middleware (global error handler)
- [ ] Rate limiting (basic, per-user)
- [ ] Remove `redis.ts` from lib (redis connection is already in `queues.ts`)
- [x] User profile routes (`/api/users`: list/search, get by id, PATCH /me)
- [x] Folder CRUD routes (`/api/folders`)

### Client (all — nothing built yet)
- [ ] Vite + Tailwind + TypeScript config (vite.config.ts, tailwind.config.js, postcss.config.js, tsconfig.json)
- [ ] API client (`/src/lib/api.ts` — fetch wrapper, all requests go to same origin since nginx proxies)
- [ ] Socket.io client (`/src/lib/socket.ts` — connect, board room join/leave, event listeners)
- [ ] Auth flow (Google Sign-In button → ID token → POST /auth/google → redirect to dashboard)
- [ ] Zustand stores:
  - `authStore` — user, org, login/logout
  - `boardStore` — current board data, groups, items, columns; socket listeners for live updates
  - `notificationStore` — notifications, unread count
- [ ] Router (react-router-dom: /login, /dashboard, /board/:id, /settings)
- [ ] Layout:
  - Sidebar (org name, board list, create board button)
  - Navbar (search, notification bell, user avatar/menu)
- [ ] Board view (the main page):
  - Column headers row (from board.columns, reorderable later)
  - Group rows (collapsible, colored header, item count, add item button)
  - Item rows (one cell per column, inline editable)
  - Add group button
- [ ] Drag and drop:
  - Items between groups (@dnd-kit sortable)
  - Group reorder (@dnd-kit sortable)
- [ ] Column type components (each renders in an item row cell):
  - StatusPill — colored pill, click opens dropdown with label options
  - PeoplePicker — avatar(s), click opens user search dropdown
  - DatePicker — date display, click opens calendar
  - TimelinePicker — date range display, click opens dual calendar
  - TextCell — inline text edit on click
  - NumbersCell — inline number edit
  - DropdownCell — select from predefined options
  - TagsCell — multi-select tags with color
  - URLCell — clickable link, edit on double-click
  - CheckboxCell — toggle
  - RatingCell — 1-5 stars
  - ProgressCell — progress bar with percentage
  - LongTextCell — opens modal/expandable for editing
- [ ] Item detail panel (slide-in panel or modal):
  - Item name (editable)
  - All column values (rendered with appropriate column component)
  - Comment thread (chronological, with reply support)
  - Attachment list (URL/text links)
  - Activity log (future)
- [ ] Comment thread:
  - Text input with @mention autocomplete (search org users)
  - Reply to comment (nested)
  - Edit/delete own comments
- [ ] Notification bell + dropdown:
  - Unread count badge
  - Click opens notification list
  - Mark as read (individual or all)
  - Click notification → navigate to relevant item
- [ ] Automation builder UI:
  - List existing automations with on/off toggle
  - Create new: trigger picker → condition builder → action picker
  - Run history view
- [ ] Board settings:
  - Columns tab (add, remove, reorder, edit labels)
  - Members tab (add, remove, change role)
  - Automations tab (links to automation builder)
- [ ] Org settings:
  - Members (invite by email, remove, change role)
  - Workspaces (create, manage)
- [ ] Login page (centered Google Sign-In button, minimal)
- [ ] Dashboard (grid of boards after login, create board card)
- [ ] Responsive layout (works on tablet, usable on phone)

## Environment Variables

```env
# Server
JWT_SECRET=change-me-to-a-random-64-char-string
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Taskr <noreply@elehmann.dev>
CLIENT_URL=https://taskr.elehmann.dev

# Database
MYSQL_ROOT_PASSWORD=change-me
MYSQL_PASSWORD=change-me

# Client
VITE_API_URL=https://taskr.elehmann.dev
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token

# Unraid port mapping (avoid conflicts)
MYSQL_PORT=3307
REDIS_PORT=6380
SERVER_PORT=3001
CLIENT_PORT=3000

# Unraid data path (uncomment and set)
# DATA_PATH=/mnt/user/appdata/taskr
```

## Commands

```bash
# Development
cd server && npm install && npx prisma generate && npx prisma db push && npm run dev
cd client && npm install && npm run dev

# Docker (full stack on Unraid)
cp .env.example .env   # fill in values
docker compose up -d
docker compose logs -f

# Database
docker compose exec db mysql -u taskr -p taskr   # direct DB access
npx prisma studio                                         # visual DB browser
```

## Setup Checklist (Unraid MVP)

1. Clone repo to Unraid (or any machine with Docker)
2. Copy `.env.example` → `.env`, fill in all values
3. Create Google OAuth credentials at https://console.cloud.google.com
   - Authorized JavaScript origin: `https://taskr.elehmann.dev`
   - Authorized redirect URI: `https://taskr.elehmann.dev`
4. Create Cloudflare Tunnel at https://one.dash.cloudflare.com → Networks → Tunnels
   - Add public hostname: `taskr.elehmann.dev` → `http://client:80`
   - Copy tunnel token to `.env`
5. Create Resend account at https://resend.com, get API key
6. `docker compose up -d`
7. Visit `https://taskr.elehmann.dev`

## Developer Context

The developer (Eric) does NOT code in the traditional sense — he vibes, prompts, and pastes terminal commands. This means:

- **Every command must be exact and copy-pasteable.** No pseudocode, no "adjust this to your setup", no `<placeholders>` without explaining exactly what to replace.
- **Never assume he can debug.** If something might fail, include the fix inline or as an "if you see X, run Y" follow-up.
- **Instructions must be sequential.** Step 1, step 2, step 3. Don't combine steps or skip assumed knowledge.
- **When generating code, generate complete files.** No "add this to your existing file" without showing the full file or exact insertion point.
- **If a command needs to run in a specific directory, always include the `cd` first.**
- **Explain errors before they happen.** If a common gotcha exists (wrong Node version, missing env var, port conflict), mention it proactively.

## Conventions

- TypeScript everywhere, strict mode
- Zod for API input validation
- Zustand for client state (no Redux)
- Tailwind for styling, no component library — build all UI components from scratch
- Socket.io events are `entity:action` format (e.g. `item:created`)
- All IDs are cuid strings
- Dates stored as ISO strings in JSON, DATE type in dedicated columns
- Concise code, minimal abstraction — this is a vibe-coded project, favor simplicity
- No `@fastify/websocket` — Socket.io is the sole websocket layer
- Nginx is the single entry point: serves SPA + proxies API + upgrades WebSocket
- All API calls from client go to same origin (no CORS in production, nginx handles routing)

## Future: Taskr MCP Server

**Status: not built yet. Build only after the GUI is feature-complete.**

Eric wants Taskr to be manageable via Claude as well as the GUI. Once the web app stabilizes, we build a Model Context Protocol server that mirrors the Taskr REST API, so Claude (and other MCP clients) can create boards, move items, assign people, manage automations, etc., with natural-language prompts.

### Design notes (for when we get to it)
- Model on the `monday-api-mcp` server we reverse-engineered from (tool surface was highly granular: `create_item`, `change_item_column_values`, `move_item_to_group`, `get_board_schema`, `get_full_board_data`, `search`, `get_user_context`, `list_workspaces`, `create_notification`, `get_updates`, `create_update`, `get_column_type_info`, etc.). Aim for parity of concepts, not of tool names.
- Transport: stdio for local, HTTP/SSE for hosted. Prefer `@modelcontextprotocol/sdk` (Node) since the rest of the stack is Node/TS. Python FastMCP is the alternative.
- Auth: reuse Taskr's JWT. Users paste a personal access token into their MCP client config; the server verifies it the same way Fastify does. Add a `PersonalAccessToken` model (hashed, scoped, optional expiry) so MCP auth doesn't share cookies with the web app.
- Tool surface (minimum useful set, in priority order):
  1. `get_user_context` — current user, recent boards, recent people
  2. `list_workspaces`, `list_boards`, `get_board_schema`, `get_board_items_page`
  3. `create_item`, `change_item_column_values`, `move_item_to_group`, `delete_item`
  4. `create_group`, `create_column`
  5. `search` (items, boards, users)
  6. `list_users`, `get_user_profile` — returns the rich profile (title, department, skills, expertise). Enables queries like "who on the team knows OAuth?"
  7. `create_comment`, `create_notification`
  8. `list_automations`, `create_automation` (later)
- The server is a **thin layer** over the existing REST routes — do NOT reimplement business logic. If an MCP tool needs capability that isn't exposed yet, add a new REST endpoint first, then have the MCP tool call it.
- Ship as its own Docker service in `docker-compose.yml` (in a new `/mcp` directory), not bundled into the main server image — different lifecycle, different auth surface.

## Reference: Monday.com Structure (reverse-engineered from live API)

This project was designed by reverse-engineering the Monday.com MCP API. Key findings that informed the architecture:

- Items are called "pulses" internally
- Column values are a flat JSON map keyed by column ID
- Status and Priority are both just "status" type columns with different label configs
- Sub-items live on a separate linked board (not nested rows) — deferred to V2
- Timeline = simple "YYYY-MM-DD - YYYY-MM-DD" string
- Groups are just labels with position — items move between them
- Monday has no native recurrence in the data model — it's all automations
- Automations are closed/opaque in the API but follow a trigger → condition → action pattern
- Webhook events include: create_item, update_column_value, create_update, move_item_to_group, etc.
