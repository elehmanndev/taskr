# Taskr — Monday.com Clone

## What This Is

Open-source, self-hosted project management tool modeled after Monday.com. Multi-tenant, real-time, with an automation engine. Built for orgs of up to 250 users.

## Deployment Target

**MVP:** Self-hosted (e.g. Unraid, home server), exposed via Cloudflare Tunnel to a domain like `taskr.example.com`. No port forwarding, no exposed IP. All services run as Docker containers via Docker Compose.

**Production (later):** VPS on a dedicated subdomain, once the MVP is validated.

## Tech Stack

- **Backend:** Node.js + Fastify + Prisma ORM + MySQL
- **Auth:** Google OAuth 2.0 + JWT (httpOnly cookie)
- **Queue:** BullMQ + Redis (automations, email, cron)
- **Email:** Resend (free tier: 3k/mo)
- **Frontend:** React 18 + Vite + Tailwind CSS + @dnd-kit + Zustand
- **Realtime:** Socket.io (one room per board, attached to Fastify's http server)
- **Serve:** Nginx (serves built React app + proxies /api, /auth, /socket.io to backend)
- **Infra:** Docker Compose (MySQL + Redis + server + client + Cloudflare tunnel)

**NOTE:** This project is designed as a standalone service. It does not depend on or integrate with any existing application stack.

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

### Server base image: `node:20-slim` (Debian) — NOT Alpine
Prisma's Alpine `linux-musl` binary requires `libssl.so.1.1`, which Alpine 3.20 removed. Debian slim + `apt-get install openssl` works cleanly and Prisma auto-detects `linux-openssl-3.0.x`. Do NOT change `server/Dockerfile` back to `node:20-alpine` — you'll spend an hour on OpenSSL compat errors. The client Dockerfile uses Alpine and that's fine (nginx + static files only, no Prisma).

### Vite env vars are build-time
Any `VITE_*` variable must be passed as a `build.args` in `docker-compose.yml` AND declared `ARG`+`ENV` in `client/Dockerfile` before `npm run build`. Changing a `VITE_*` in `.env` requires `docker compose build --no-cache client`, not just `up -d`. If the client shows "Missing VITE_XXX in environment", that's the cause.

### rrule is CommonJS
`rrule` ships as CJS, so in the ESM-compiled server it must be imported as `import rrulePkg from 'rrule'; const { RRule } = rrulePkg`. Named-export `import { RRule } from 'rrule'` will crash at runtime with `SyntaxError: Named export 'RRule' not found`.

### Socket.io setup
- Socket.io `Server` is attached to Fastify's underlying http server AFTER `app.listen()`.
- Do NOT use `@fastify/websocket` — it conflicts with socket.io. Socket.io is the sole websocket layer.
- `initSocket(app)` must be called in `index.ts` after `app.listen()`.
- Nginx proxies `/socket.io/` with websocket upgrade headers.

### Nginx as single entry point
- Client Nginx serves the React SPA on port 80 inside the container.
- All `/api/*`, `/auth/*`, `/health`, and `/socket.io/*` requests are proxied to the `server` container on port 3001.
- Cloudflare Tunnel points `taskr.example.com` → `http://client:80`.
- This means the client's VITE_API_URL should be the same domain (e.g. `https://taskr.example.com`) — the nginx proxy handles routing.

### Google OAuth with Cloudflare Tunnel
- Google OAuth requires HTTPS + a real domain for redirect URLs.
- Cloudflare Tunnel provides this for free — no certificates to manage.
- Google Console authorized redirect URI: `https://taskr.example.com/auth/google/callback`
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

## Design & UX Direction (agreed 2026-04-19)

Scope was defined by reviewing Monday.com screenshots together. We are **not** copying everything Monday has — only the items below. Resist feature creep from future screenshots unless Eric explicitly asks.

### Visual style

- **Font:** Inter everywhere (loaded from Google Fonts or self-hosted; no Figtree/Roboto fallback dance).
- **Themes:** three, all shipped up-front.
  - **Night** (default) — dark navy background, matches Monday's "Night" theme. This is what Eric uses.
  - **Light** — white background.
  - **Black** — true-black OLED-friendly.
- Theme switcher lives in the avatar dropdown (top-right).
- Implementation: CSS variables on `:root[data-theme="night|light|black"]`, Tailwind reads them via `theme.extend.colors` referencing the vars. No `dark:` classes.
- **Board visual priorities** (current BoardView is a generic table — this is the biggest gap):
  - Column header band visually distinct from cell content (darker, stronger weight, clear border).
  - Groups rendered as elevated **cards** with rounded corners + inner padding — not a flat stripe. Thick colored left bar + chevron + item count next to name.
  - Status pills fill their cell fully (vertical + horizontal), bold uppercase white text.
  - Tighter row height than current.
  - Per-row hover icon: quick "write update" speech-bubble + plus.
  - Column header click → sort cycle (asc → desc → off); right-click or menu → filter/hide.

### Feature scope

Order of attack: **(a) board visual overhaul first**, then the new sections below. New pages inherit the style system once it's set.

**Board enhancements**
1. Column header hierarchy + group-as-card polish.
2. Column sort/filter from header.
3. **Board width management**: pin first N columns (sticky-left), auto-collapse columns with no values on visible items, "focus mode" = user selects subset of columns to show (saved per view, extends the existing "Ocultar" toolbar button).
4. Per-row quick update composer — posting notifies everyone involved with the item.
5. Collapsible sidebar.

**New pages / sections**
6. **View tabs on a board**: table, calendar, custom filtered table (user picks a column + value, saved as named tab). No kanban, no timeline, no workload.
7. **Mi trabajo** — cross-board aggregate of items I'm assigned to / mentioned in / subscribed to. Own Tabla + Calendario tabs, grouped by date bucket (Hoy / Esta semana / Próximo / Fechas pasadas / Sin fecha).
8. **Feed de actualizaciones** — cross-board feed of comments/updates on items I'm involved with. Filter tabs: Todas / Me mencionaron / Marcado como favorito / Toda la cuenta.
9. **Profile page** redesigned — card-based layout, left tab nav (Información personal / Situación laboral / Notificaciones / Idioma y región / Contraseña / Historial de sesión), right rail for contact fields. Adds `slackUserId` to User.
10. **Workmates (People directory)** — grid of person cards with avatar, name, email (copyable), Slack deep-link button (`slack://user?team=…&id=…`).
11. **Etiquetas (Tags) index** — org-level tag registry page, alphabetical sections, usage count per tag. Tags become first-class entities (migration required — see Data Model below).
12. **Spotlight global search** — modal over the app, large search input, recent items, keyboard navigation (↑↓ + Enter). Mixed results: boards, workspaces, items, people.
13. **Equipos (Teams)** — sub-org groupings distinct from department; user can be in many. Assignable like people; `@teamname` mentions expand to team members.
14. **Horarios (Schedules)** — user work schedules (fixed weekly or rotating shift pattern) editable from profile. Page with department filter, daily view, monthly calendar view with pagination. Useful for shift-based teams; M–F teams just show the default.

### Data model additions (plan — not yet migrated)

- **User**: add `slackUserId: String?`.
- **Tag** (new): `id, orgId, name, color, createdAt`. Migrate existing free-form tag strings from TAGS column values into this table + join.
- **Team** (new): `id, orgId, name, color, createdAt`.
- **TeamMember** (new): `teamId, userId, role?`.
- **WorkSchedule** (new): `userId, pattern (JSON: weekly shifts or rotation), timezone`.
- **ScheduleException** (new): `userId, date, type (vacation|sick|swap|other), shift?`.
- **Comment**: add `likes` (user-list relation) and a per-user **bookmark/favorite** flag (separate pivot table).
- **BoardView** (new): `id, boardId, name, type (TABLE|CALENDAR|FILTERED_TABLE), filters JSON, sortBy JSON, groupBy, hiddenColumns JSON, order`. Replaces the ad-hoc "views" we don't have yet.
- **Favorites** (new pivot): `userId, entityType (BOARD|ITEM|COMMENT), entityId`.

Do the migration in one pass before or alongside building the matching UI, not piecemeal.

### What we are explicitly NOT doing

Kanban view, timeline/Gantt view, workload view, Monday.labs-style apps marketplace, integrations marketplace, dashboards, widgets, docs feature, Monday CRM, form builder, mobile app, app grid / 9-dot switcher in the navbar, country-flag badge overlay on avatar.

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

### Client
Scaffolding + core wiring is done and deployed. Biggest remaining gap is visual fidelity — current board view is a generic table, not recognizably Monday-like.

- [x] Vite + Tailwind + TypeScript config
- [x] API client (`/src/lib/api.ts`)
- [x] Socket.io client (`/src/lib/socket.ts`)
- [x] Auth flow (Google Sign-In → POST /auth/google → protected routes)
- [x] Zustand stores: `authStore`, `boardStore`, `notificationStore`
- [x] Router (/login, /dashboard, /board/:id, /profile, /users/:id)
- [x] Layout: Sidebar, Navbar, AppLayout
- [x] Board view skeleton: BoardView, ColumnHeader, GroupRow, ItemRow
- [x] Login page
- [x] Dashboard
- [x] Column cells built: StatusPill, PeoplePicker, DateCell, TextCell, CheckboxCell, EmailCell, PhoneCell, FileCell, LinkCell (+ ColumnCell dispatcher)
- [x] **Theme system** (2026-04-19): Night/Light/Black via CSS vars on `:root[data-theme]`, Tailwind semantic tokens (`surface`, `text-primary`, `border`, `accent`, etc. — see `index.css` + `tailwind.config.js`). Theme switcher lives in the avatar dropdown.
- [x] **Board visual pass #1** (2026-04-19): column header band (uppercase, darker bg, distinct border), group-as-card (elevated rounded surface with full-height colored left bar + chevron + item count), tighter 36px rows, status pills fill cells (bold uppercase white), hover-revealed quick-update icon (UI only, no composer yet).
- [x] **Column sort from header** (2026-04-19): click a column header to cycle asc → desc → off; sort lives in BoardView local state, not yet persisted.
- [x] **Collapsible sidebar** (2026-04-19): toggle button in sidebar header, width persisted to localStorage.
- [x] **Visual pass #2** (2026-04-19, commits `9c733de` + `20e9063`): per-group sticky column header (replaces the single global sticky), per-column widths (`client/src/components/board/columnWidth.ts` — PEOPLE 96, STATUS 130, TIMELINE 180, CHECKBOX/RATING 80, LONG_TEXT 220, default 150), `PeoplePicker` +N overflow chip (2 avatars visible), 44px rows, new `TimelineCell` with `5 abr – 11 abr` (es-ES, no year) + click-to-open range popover, `DateCell` es-ES short format, Night/Black contrast bump (text tokens brightened + column headers and sidebar section labels promoted), colored group left bar constrained to items region (top:40 bottom:40) so it doesn't clash with rounded card corners.
- [ ] **Visual pass #3 queue** (raised 2026-04-19 during live review — full detail in `project_ui_overhaul_plan.md`):
  - Sticky scope too tight — fold group-name bar into the card so the sticky covers the whole group, not just the card region.
  - Light theme unreadable — sidebar "BOARDS"/"ALL BOARDS" labels clipped on the left; overall contrast too faint.
  - Comments → dedicated narrow column — move the hover speech-bubble + delete-X out of the item-name cell into their own cell (Monday's updates-column pattern).
  - Drop dead columns from the imported board backend: PRODUCTO (×2), SUBPRODUCTO, ESTACIÓN (and possibly NÚMEROS 1 — Eric said "four", ask which stays). Update `server/scripts/import-monday.ts` and delete from DB.
  - `Histórico` / archived group muted styling (low opacity, gray accent, collapsed-by-default).
  - **Brand column** (part of ESTADO split) with per-brand hex palette — AMI INT amber, DJT dark teal, VPT purple, AMI green, **JUM orange/peach, BTR beige/tan** (swapped from Eric's first pass), AADIA periwinkle, SKI bright blue, SKI INT cyan, BUC pink/magenta.
  - CRONOGRAMA rendered as colored pill with progress-bar fill (% elapsed between from→to) + hover tooltip showing total day count.
  - Collapsed groups render as a compact card (no column row, no add-item row) — click anywhere to expand.
  - Pull real status-pill colors from Monday via `monday-api-mcp` (currently falls back to gray `#C4C4C4`).
  - ESTADO column restructure → split into Estado / Brand / Tipo de tarea / Etiquetas (requires migration of existing imported values).
- [ ] Quick-update composer: icon exists on item-row hover, click is currently a no-op. Wire to open a popover that posts a Comment and fires notifications to everyone involved with the item.
- [ ] **Board width management**: pin first N columns (sticky-left with shadow), auto-collapse columns with no values on visible items, "focus mode" (user-selected subset). Extend the existing "Ocultar" concept.
- [ ] **View tabs** below the board title: table / calendar / custom filtered-table. Requires the `BoardView` server model from the Design & UX Direction section (not yet migrated).
- [ ] Remaining column cells: TimelinePicker, NumbersCell, DropdownCell, TagsCell, URLCell, RatingCell, ProgressCell, LongTextCell
- [ ] Drag and drop with @dnd-kit (items between groups, group reorder) — dependency not yet installed
- [ ] Item detail panel (slide-in/modal with column values, comments, attachments)
- [ ] Comment thread UI (text input with @mention autocomplete, replies, edit/delete)
- [ ] Notification bell + dropdown (store exists, no bell component yet)
- [ ] Automation builder UI (trigger → condition → action; run history)
- [ ] Board settings (columns, members, automations tabs)
- [ ] Org settings (members invite/remove, workspaces)
- [ ] Responsive layout polish (tablet/phone)

New pages in scope (from Design & UX Direction — none started):
- [ ] Mi trabajo (cross-board aggregate)
- [ ] Feed de actualizaciones
- [ ] Workmates (people directory with Slack deep-link — needs `slackUserId` on User)
- [ ] Etiquetas index (needs Tag model migration first)
- [ ] Spotlight global search modal
- [ ] Profile page redesign (card-based with left tab nav)
- [ ] Equipos (Teams — needs Team + TeamMember models)
- [ ] Horarios (needs WorkSchedule + ScheduleException models)

## Environment Variables

```env
# Server
JWT_SECRET=change-me-to-a-random-64-char-string
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Taskr <noreply@example.com>
CLIENT_URL=https://taskr.example.com

# Database
MYSQL_ROOT_PASSWORD=change-me
MYSQL_PASSWORD=change-me

# Client
VITE_API_URL=https://taskr.example.com
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
   - Authorized JavaScript origin: `https://taskr.example.com`
   - Authorized redirect URI: `https://taskr.example.com`
4. Create Cloudflare Tunnel at https://one.dash.cloudflare.com → Networks → Tunnels
   - Add public hostname: `taskr.example.com` → `http://client:80`
   - Copy tunnel token to `.env`
5. Create Resend account at https://resend.com, get API key
6. `docker compose up -d`
7. Visit `https://taskr.example.com`

## Conventions

- TypeScript everywhere, strict mode
- Zod for API input validation
- Zustand for client state (no Redux)
- Tailwind for styling, no component library — build all UI components from scratch
- Socket.io events are `entity:action` format (e.g. `item:created`)
- All IDs are cuid strings
- Dates stored as ISO strings in JSON, DATE type in dedicated columns
- Concise code, minimal abstraction — favor simplicity
- No `@fastify/websocket` — Socket.io is the sole websocket layer
- Nginx is the single entry point: serves SPA + proxies API + upgrades WebSocket
- All API calls from client go to same origin (no CORS in production, nginx handles routing)
- **Every shell command block must be prefixed with where to run it** — machine (laptop vs Unraid vs container), shell (PowerShell vs bash vs docker exec), and directory. Commands vary between these contexts (e.g. `$env:VAR=...` in PowerShell vs `VAR=... cmd` in bash).

## Future: Taskr MCP Server

**Status: not built yet. Build only after the GUI is feature-complete.**

Taskr should be manageable via MCP clients (Claude, etc.) as well as the GUI. Once the web app stabilizes, build a Model Context Protocol server that mirrors the Taskr REST API, so MCP clients can create boards, move items, assign people, manage automations, etc., with natural-language prompts.

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
