# Security Audit Process

Three-phase audit workflow for Taskr. Run in order. Each phase's findings live at the bottom of this doc.

## Phase 1 — Static code review

Audit the server code for authorization, auth, input validation, automation abuse, XSS, secrets, headers, rate-limit.

Spawn a general-purpose agent against `server/src/routes/*.ts`, `server/src/services/*`, `server/src/workers/*`, `server/src/lib/*`, `server/src/index.ts`. Ask for severity-ranked findings with `file:line` + attack scenario + one-line fix sketch. Focus on:

1. Cross-tenant authorization holes (every route handler must verify caller membership of the resource's org/board, not trust IDs from request).
2. JWT / OAuth (aud check, email_verified, cookie flags, lifetime, revocation).
3. Zod validation coverage; mass-assignment from `req.body`.
4. Automation engine abuse (SEND_EMAIL as open relay, NOTIFY_PERSON as phishing primitive, actions running without target-ownership checks).
5. Stored XSS in comments / email template interpolation.
6. Weak secret fallbacks, missing rate limit, missing helmet.

## Phase 2 — Live probing against `taskr.elehmann.dev`

### 2a — Unauthenticated surface

No creds needed. Use `curl`:
- Security headers on `/` and `/api/*` (HSTS, CSP, X-Frame, X-Content-Type, Referrer, Permissions).
- Unauth response codes on `/api/boards`, `/api/orgs`, `/api/users`, `/api/notifications`, `/api/folders`, `/health`.
- CORS — Origin probe + OPTIONS preflight.
- Rate limit on `/auth/google` — 20 rapid POSTs with junk idToken.
- Error info leak — malformed JSON + junk token.
- Socket.io anon connection + `board:join` on a fake boardId.

Script lives at `scripts/probe-unauth.sh` (TODO: extract from session).

### 2b — Authenticated cross-tenant probing

Needs:
1. Attacker JWT — grab `token` cookie from browser on `taskr.elehmann.dev`.
2. Victim org + board + item that attacker is NOT a member of. Seed via `server/scripts/seed-victim.mjs` (run from worktree if schema has drifted from main). Script prints JSON with 6 IDs.

**Setup command (PowerShell, main repo):**
```powershell
$env:DATABASE_URL="mysql://taskr:<MYSQL_PASSWORD>@<UNRAID_IP>:3307/taskr"
node scripts/seed-victim.mjs
```

**PoC script:** `scripts/poc-cross-tenant.sh`. Edit JWT + victim IDs at top, run `bash scripts/poc-cross-tenant.sh`. Tests C1–C4, C7, C9 by PATCH/POST against victim resources. Expects all to return 4xx after fix; before fix they return 200/201.

### 2c — Cleanup after probing

Delete the victim org — cascades to workspaces, boards, groups, items, comments, automations, and the OrgMember row for the attacker. Script: `server/scripts/cleanup-victim.mjs` (takes `victim_orgId` as arg).

## Phase 3 — Edge / Cloudflare infra (pending)

- Cloudflare zone: WAF rules, Bot Fight Mode, rate limit rules, Super Bot Fight config.
- Consider Cloudflare Access in front of `taskr.elehmann.dev` for admin-only deployments.
- Tunnel config hygiene — tunnel token rotation, no wildcard hostnames.
- Check cloudflared container: pinned version, restart policy, resource limits.

## Fix Strategy

Order:
1. **Cleanup** live test residue.
2. **Fix A** — authorization middleware + the org-member takeover route. Single PR. Deploy. Re-run Phase 2b. Expect every test to return 403/404.
3. **Fix B** — everything else (JWT hardening, socket.io auth, comment/email XSS, global error handler, rate limit, helmet, `email_verified`, weak-secret startup check). Separate PR after A is verified.

---

## Findings log

### 2026-04-18 — initial audit

**Phase 1:** 10 CRITICAL, 7 HIGH, 7 MEDIUM, 5 LOW. Full report in session transcript.

**Phase 2a confirmed live:**
- L1 — no security headers (HSTS, CSP, X-Frame, X-Content-Type, Referrer, Permissions all missing).
- M4 — no rate limit; 20 rapid `/auth/google` POSTs processed, zero 429s.
- M1 — no global error handler; junk idToken returns 500 with raw library message `"Wrong number of segments in token: garbage"`.
- H4 — Socket.io accepts anonymous handshake; `board:join` accepted without check.
- CORS correctly locked to single origin (not exploitable).

**Phase 2b confirmed live (attacker = any Google user, not a member of victim org):**
- C1.read — filtered correctly (GET `/api/boards/:id` requires PUBLIC or member). Audit was wrong on this one.
- C1.write — PATCH board cross-tenant: ✅ 200.
- C2.read — GET item cross-tenant: ✅ 200.
- C2.write — PATCH item cross-tenant: ✅ 200.
- C3.write — PATCH group cross-tenant: ✅ 200.
- C4.read/write — list/post comments cross-tenant: ✅ 200/201.
- C7.write — create automation on victim board: ✅ 201.
- **C9 — full org takeover: ✅ 201.** Any authenticated user can `POST /api/orgs/<any-orgId>/members` with `role: OWNER` and become owner.

**Phase 3:** not run yet.

**Fix A** implemented on branch `claude/security-fix-a`:
- New `server/src/middleware/access.ts` with guards: `requireOrgMember`, `requireOrgAdmin`, `requireBoardAccess`, `requireItemAccess`, `requireGroupAccess`, `requireAutomationAccess`, `requireFolderAccess`, `requireCommentOwner`, `requireItemAccessForComment`.
- Every mutating route in `boards.ts`, `items.ts`, `groups.ts`, `automations.ts`, `folders.ts` wired to the appropriate guard.
- `items.ts` POST and POST /reorder additionally verify target groupIds belong to the URL board.
- `groups.ts` comment POST filters `mentions[]` to org members only (C4 phishing primitive closed); PATCH/DELETE require ownership.
- `orgs.ts` member add/remove is now OWNER/ADMIN only; role escalation (granting OWNER/ADMIN) requires OWNER; last-OWNER removal blocked (C9 closed).

**Fix status:** A implemented, pending deploy + re-probe. B not started.
