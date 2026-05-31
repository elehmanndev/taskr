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

- **Font:** Inter everywhere (loaded from Google Fonts; no Figtree/Roboto fallback dance). Tried Outfit on 2026-05-07, reverted.
- **Themes:** Night only. Day (Light) and Black were removed on 2026-05-07 — single dark theme keeps the design language consistent and avoids contrast bugs in the multi-color status pills. The `data-theme` attribute is still set on `<html>` for forward-compat, but only `night` exists.
- Implementation: CSS variables on `:root[data-theme='night']`, Tailwind reads them via `theme.extend.colors` referencing the vars. No `dark:` classes.
- **Popover system (2026-05-07):** every floating panel (status dropdowns, date pickers, mention/assignee suggesters, comment modal, navbar dropdowns, profile hover-card) reads from `--popover-bg` (#14162b) / `--popover-border` / `--popover-shadow` in `client/src/index.css`. Single source of truth — when building anything new, set `backgroundColor: 'var(--popover-bg)'` and inherit the look. App background uses the same #14162b so popovers blend with the page; group cards lift via `--surface` (#1f2240).
- **Brand-color contrast helper:** `darkenForContrast(hex)` in `client/src/components/columns/colors.ts` darkens any bright brand hex (yellows, peach, light blues) just enough to keep white text readable. Use it for any colored chip/pill/header where the underlying color comes from user data — never switch text color to dark, always darken the bg instead. Used by StatusPill, GroupRow header icon block, GroupRow count pill, TimelineCell.
- **Wordmark component:** `client/src/components/ui/Wordmark.tsx` renders the "taskr." mark — extrabold lowercase Inter with `letter-spacing: -0.055em` and a gradient period (accent → purple). Sizes: `sm` (navbar), `md`, `lg` (login). Use this anywhere Taskr is named, not raw text.
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
14. **Horarios (Schedules)** — **a side feature of each department, NOT a board.** Boards are for tasks; the roster is a different data shape (person × day → shift) and gets its own module hanging off the department. You open a department and its roster sits alongside its people. M–F desk departments show a fixed weekly default; shift-based departments (Booking) assign a **shift template** per person per day. Daily view + monthly calendar with pagination, scoped to that department. See "Shift rostering + daily assignment" below for the full spec (reverse-engineered from the `HORARIOS BOOKING 2026` + `Planning diario` Google Sheets, 2026-05-31).

### Data model additions (plan — not yet migrated)

- **User**: add `slackUserId: String?`.
- **Tag** (new): `id, orgId, name, color, createdAt`. Migrate existing free-form tag strings from TAGS column values into this table + join.
- **Team** (new): `id, orgId, name, color, createdAt`.
- **TeamMember** (new): `teamId, userId, role?`.
- **Department** (new, or promote the current `User.department` string): `id, orgId, name`. The roster is a side feature of a department, so department needs to be at least enumerable. Keep `User.departmentId` (was a free string). OPEN: confirm whether a desk team and Booking are both "departments" or if Booking is a department with sub-teams.
- **ShiftTemplate** (new): `id, departmentId, label, color, segments (JSON: [{ start, end }], supports split shifts), crossesMidnight`. Defined once per department, picked from a dropdown — kills the spreadsheet's typo-variants (`16,00` vs `16,30` vs `16,15`, `:` vs `,`, `8-13/13:30-16:30` vs `8 a 13 y 13,30 a 16,30`) and makes hours computable. **Definitive Booking set = 8 bands** (reverse-engineered across all 12 months, 2026-05-31; **no seasonal variation — Jul/Aug = Dec**): Mañana 1 `8–13 / 13:30–16:30`, Mañana 2 `9–14 / 14:30–17:30`, Tarde `13:30–17 / 17:30–22`, Cierre `16–20 / 20:30–24`, Nocturno `23:59–07:59` (crosses midnight), Seguida tarde `14–21` (continuous), Tarde corta `11–17 / 17:30–19:30`, Continuo `9:30–15:30`. The ~50+ literal cell strings collapse to these 8; the `±30min` end tweaks, recuperation hours, and one-off personal shifts (e.g. Reinier `10:14–17:21`) are per-assignment `customSegments`, NOT templates. Seeded by `POST /api/schedules/templates/seed-defaults`.
- **ShiftAssignment** (new): `id, userId, date, templateId?, customSegments? (JSON, for one-off hours), role? (e.g. responsable_mañanas | responsable_tardes), note? (swap notes: "trabaja a cambio de librar el 30/11"), status (working | off | vacation | sick)`. One row per person per day — replaces both the free-text roster cell AND the old `ScheduleException`. Coverage counts (the sheet's hand-tallied `14/10` row) become automatic: sum assignments per time-slot per day.
- **User** (routing attributes for skill-aware assignment): `languages (JSON: [{ code: 'pt'|'fr'|'en'|'de'|'it', level: 1|2|3, spoken: bool, written: bool }])`, `brandPrefs (JSON: ordered ['BUC','AMI','ESQ','J2S'])`. Structures the `Idiomas` matrix + brand preference so the daily picker can sort by fit. Extends the existing `skills[]`/`expertise[]` rather than replacing them.
- **Comment**: add `likes` (user-list relation) and a per-user **bookmark/favorite** flag (separate pivot table).
- **BoardView** (new): `id, boardId, name, type (TABLE|CALENDAR|FILTERED_TABLE), filters JSON, sortBy JSON, groupBy, hiddenColumns JSON, order`. Replaces the ad-hoc "views" we don't have yet.
- **Favorites** (new pivot): `userId, entityType (BOARD|ITEM|COMMENT), entityId`.

Do the migration in one pass before or alongside building the matching UI, not piecemeal.

### Shift rostering + daily assignment (reverse-engineered 2026-05-31)

The Booking team runs three Google Sheets that taskr should collapse into one flow. Reading them defined the model above. The pipeline is **roster → daily plan**, and it's really a constraint-matching problem the responsable does by hand every morning.

**Source sheets:**
- `HORARIOS BOOKING 2026` — one tab per month, weeks stacked vertically, ~34 people × 7 days. Each cell is a free-text shift. This is the **roster**.
- `Planning diario` — one tab per responsable. Each day: the people on shift (copied from the roster) are distributed across **brands** (BUC/AMI/ESQ/J2S/extras) × **task queues** (Urg, Prioris, Vi, Verdes, ROJOS by language PT/FR/EN/DE/IT, Negros ahir/avui, Premium, Docus, Transfers…). Verde/Rojo/Negro = reservation status colors.
- Support tabs: `Idiomas` (language matrix — PT/FR/EN/DE/IT × Nivel 1–3 × hablado/escrito), `Control PC`, `hoja para cambios` (swap scratchpad).

**The three inputs the responsable cross-references manually each day:**
1. **Supply** — who's on shift today + their hours (a morning-only person can't take an evening queue). → from the **roster** (Horarios, the per-department side feature).
2. **Demand** — which task queues exist today, per brand/type. → **task surface** (board-like; this is the only board-shaped piece).
3. **Fit** — each person's language level, brand preference, responsable role. → **profile routing attributes** (`languages`, `brandPrefs`).

**What taskr automates:** taskr already holds all three (roster, tasks, profiles), so the daily plan stops being a memory exercise. The killer UX: clicking a queue's people cell (e.g. `ROJOS PT`) opens a picker showing **only people on shift today**, **best-fit first** (speaks Portuguese, prefers the brand). The human still decides; taskr does the lookup. With every input structured, "suggest assignments" / auto-fill becomes a later, cheap addition.

**Hard boundaries (don't blur these):**
- **Horarios (roster) is NOT a board.** It's a per-department side feature with its own module + data shape. Do not model shifts as items/groups/columns.
- **The daily plan IS task-shaped** and can be a board (or board-like view): groups = brands, items = queues, PEOPLE column = assignment, STATUS pills = Verde/Rojo/Negro.
- The "on-shift-today" filter is the **bridge** between the roster module and the task surface — derived from `ShiftAssignment`, not stored on the board.
- ~half of this already exists in taskr (boards, groups, items, PEOPLE picker, StatusPill, rich profiles). The genuinely new build is the roster module + the two profile routing fields + the on-shift filter on the picker.

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
- [x] **Item assignee endpoints** (2026-05-07): `POST /api/boards/:boardId/items/:itemId/assignees` and `DELETE .../:userId`. Validate the assignee shares an org with the board, emit `item:updated`, fire `ASSIGNEE_CHANGED` automation trigger.
- [x] **Lazy item loading** (2026-05-07): `GET /api/boards/:boardId` no longer includes items — just groups + `_count.items`. New `GET /api/boards/:boardId/groups/:groupId/items?cursor=&limit=` returns one group's items paginated by position cursor (default 20). Initial board load went from multi-second / multi-MB to ~200ms / 9 KB on the 1872-item MKT VPT board.
- [x] **Dev login bypass** (2026-05-07): `POST /auth/dev-login` (404 in production) issues a JWT cookie for a seeded `dev@taskr.local` user. Lets local sessions skip Google OAuth — used by the preview tooling and quick local testing.
- [x] **Group default collapsed** (2026-05-07): `Group.collapsed @default(true)` in `schema.prisma` + DB updated. New imports/groups start collapsed so opening a board doesn't pre-fetch every group's items.

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
- [x] **Visual passes #3, #4, #5** (2026-04-19 → 2026-05-07): all original pass-3 queue items shipped (sticky fix, light theme dropped instead of fixing, dedicated updates column, dead columns removed, Histórico muting, brand column with real colors, CRONOGRAMA pill with progress fill, collapsed compact cards, real Monday status colors, ESTADO split). Then #5 went further — see "Session 2026-05-07" below.
- [x] **Quick-update composer** (2026-04-19): wired. Click the speech-bubble icon → opens `UpdateModal` which loads/posts comments and updates the local count.
- [x] **Comment thread UI** (2026-05-07): `UpdateModal` rebuilt with @mention autocomplete (search `/api/users?q=`, replaces `@xxx` on select, sends `mentions: [{userId, name}]` with the comment), URL linkification in rendered comments, mentions styled as accent pills via `renderBody()`. ⌘+Enter to publish.
- [x] **People assignment UI** (2026-05-07): `PeoplePicker` rebuilt — click empty cell or any avatar opens a search popover with Asignados (× to remove) + Sugerencias sections. Hover an avatar = profile peek; click = picker (the previous behavior was reversed).
- [x] **`ProfilePopover` → hover-card** (2026-05-07): now opens on hover with a 250ms delay and closes 200ms after leaving. Click no longer triggers the popover; pass `onClick` to attach behavior (used by PeoplePicker to open the assigner).
- [ ] **Board width management**: pin first N columns (sticky-left with shadow), auto-collapse columns with no values on visible items, "focus mode" (user-selected subset). Extend the existing "Ocultar" concept.
- [ ] **View tabs** below the board title: table / calendar / custom filtered-table. Requires the `BoardView` server model from the Design & UX Direction section (not yet migrated).
- [ ] Remaining column cells: NumbersCell, DropdownCell, TagsCell, URLCell, RatingCell, ProgressCell, LongTextCell. (TimelinePicker shipped as TimelineCell.)
- [ ] Drag and drop with @dnd-kit (items between groups, group reorder) — dependency not yet installed
- [ ] Item detail panel (slide-in/modal with column values, comments, attachments) — partially served by UpdateModal but no full detail view yet
- [ ] Notification bell + dropdown (store exists, no bell component yet)
- [ ] Automation builder UI (trigger → condition → action; run history)
- [ ] Board settings (columns, members, automations tabs)
- [ ] Org settings (members invite/remove, workspaces)
- [ ] Responsive layout polish (tablet/phone)
- [ ] **Image paste / upload** in updates — server endpoint + storage under `data/uploads/` + paste handler. Discussed 2026-05-07, not built. Real lift, ~20 min.

New pages in scope (from Design & UX Direction — none started):
- [ ] Mi trabajo (cross-board aggregate)
- [ ] Feed de actualizaciones
- [ ] Workmates (people directory with Slack deep-link — needs `slackUserId` on User)
- [ ] Etiquetas index (needs Tag model migration first)
- [ ] Spotlight global search modal
- [ ] Profile page redesign (card-based with left tab nav)
- [ ] Equipos (Teams — needs Team + TeamMember models)
- [ ] Horarios — per-department roster side feature (needs Department + ShiftTemplate + ShiftAssignment models). NOT a board. Feeds the daily-plan picker via an "on-shift-today" filter. See "Shift rostering + daily assignment".

## Session 2026-05-07 — UI restructure + perf

Big visual + structural pass. Key invariants for anything built going forward:

### Layout
- **Sidebar removed.** `AppLayout` is just `<Navbar />` + `<main><Outlet /></main>`. The `Sidebar.tsx` file still exists but is unused — keep around for the nav patterns until decided otherwise.
- **Board navigation lives in the navbar.** Wordmark | Home icon (→ /dashboard) | board-selector pill (current board name with chevron, dropdown lists all org boards). Right side: avatar dropdown.
- **No org selector.** Multi-org switching deferred — single org assumed.
- **No `<h1>` on BoardPage.** Board name is in the navbar selector, no need to repeat it.

### Group cards
- All groups default-collapsed (`Group.collapsed @default(true)`). Existing imported groups were updated.
- Each expanded group is a self-contained card with internal scroll (`max-height: 60vh`, `overflow-auto`). Items load 20 at a time via `loadGroupItems` in `boardStore`; an IntersectionObserver inside the scrollable area triggers the next page.
- Collapsed and expanded headers are visually identical: neutral surface bg, brand-color icon block (40×40, rounded-xl) on the left containing the chevron, name in `text-text-primary`, count pill in `darkenForContrast(brand)` with white text. The only difference is what's below the header (collapsed: nothing; expanded: scrollable items + add-row).
- Hover glow on collapsed cards via a blurred radial in the brand color.
- Spread between collapsed cards: `mb-5` (20px).

### Status / brand pills
- Render as pills inside cells (not full-cell color blocks). `min-w-[75%] px-3.5 py-1.5 rounded-full`, white text, `darkenForContrast(brand)` bg.
- Dropdowns use `--popover-bg`, `space-y-2`, hairline divider before the Clear option.

### Cronograma (timeline) cells
- **Upcoming** (status === 'upcoming'): outlined dashed pill in `darkenForContrast(brand)` with secondary text — visibly different from in-progress.
- **Active / past**: solid darkened pill with a `rgba(255,255,255,0.4)` overlay covering `pct%` from the left. White text always.

### Updates / comments
- Speech-bubble icon: outlined Monday-style SVG (rounded square with bottom-left tail). Count number renders centered inside the bubble body (use `pb-[5px]` to offset the tail). Always visible at default opacity for items with comments; muted-and-hover-revealed when count is 0 — actually now always shown.
- `UpdateModal`: rebuilt with the popover token system. Compose box has gradient Publicar button. @mention autocomplete fetches `/api/users?q=&orgId=`. URL pasting is auto-linkified in rendered comments via `renderBody()`. Mentions render as accent pills.

### Assignment
- `PeoplePicker` opens on cell click or avatar click. Lists current Asignados (with × to remove) + Sugerencias from `/api/users` filtered by typed query. Server validates org membership.
- `ProfilePopover` is now a hover-card (open after 250ms hover, close 200ms after leave). Pass `onClick` to override click behavior — PeoplePicker passes a handler that opens the assigner.

### Login
- `taskr.` wordmark replaces the old block logo. Glass card on a soft radial-glow + dot-grid backdrop. Footer: `Reverse-Engineered by [github icon]` + the repo URL.
- GSI script lazy-loaded inside `Login.tsx` (was global in `index.html`) — keeps the script off authenticated pages and unblocks headless screenshot tooling.

### Terminology
- Use **"Tareas"** (Spanish) for items in user-facing strings. Updated count labels, add-row placeholder, "Cargando…", dashboard card subtitle.

### Pending from this session
- Image paste in updates (need upload endpoint + `data/uploads/` storage + paste handler).
- Sidebar.tsx file is unreferenced — delete or keep for later patterns.
- Mention autocomplete only works in `UpdateModal` — apply to other rich-text inputs when they exist.

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
