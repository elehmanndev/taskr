# Monday Import — State & Handoff

Source Monday board: **1211467504** (MKT VPT). Target: Taskr DB on Unraid (192.168.1.45:3307).

## Strategy

Option 2 (per-group `searchTerm` chunks via `get_board_items_page`). First pass imported 217 items into 4/14 groups. This pass fills 9 more groups.

## Group ID mapping

| File | Monday group ID | Status |
|---|---|---|
| items-page-1.json | 1695378509_hoja_de_c_lculo_sin | imported |
| items-vacaciones.json | grupo_nuevo92850 | imported |
| items-compensa.json | grupo_nuevo92850 | imported |
| items-guardia.json | grupo_nuevo56127 | imported |
| items-bajas.json | grupo_nuevo__1 | imported |
| items-newsletter.json | grupo_nuevo75562 | **pending** |
| items-sms.json | grupo_nuevo62885 | **pending** (re-fetch) |
| items-push.json | grupo_nuevo25234 | **pending** |
| items-blog.json | grupo_nuevo3251 | **pending** |
| items-reuniones.json | grupo_nuevo23254 | **pending** (re-fetch) |
| items-web.json | grupo_nuevo77425 | **pending** |
| items-branding.json | grupo_nuevo | **pending** (re-fetch) |
| items-paid.json | grupo_nuevo19497 | **pending** |
| (data group) | — | empty — "dashboard" returned 0 hits; awaiting Eric's direction |

## Persisted MCP tool-result files (read one at a time)

Path prefix: `C:\Users\Eric\.claude\projects\C--Users-Eric-Projects-taskr--claude-worktrees-silly-ardinghelli-9f2f9b\52482f8e-82b3-4890-a52d-16aa6e8e3229\tool-results\`

| File | searchTerm | Items | has_more | → dump |
|---|---|---|---|---|
| toolu_01Bm6Bt7sgEvf5eRu93DNuki.txt | landing | 75 | false | items-web.json |
| toolu_01LLva1a1AEunK5sQzjheAJd.txt | newsletter | 100 | true | items-newsletter.json |
| toolu_01KrS1VvB9z3jEUz9SDPEAy1.txt | push | 100 | true | items-push.json |
| toolu_01FFLxMGVs47BFwXZMSnfx8T.txt | blog | 100 | true | items-blog.json |
| toolu_015YN1qRVr2m5i6XXrvVbkhy.txt | ads | 100 | true | items-paid.json |

## 3 groups to re-fetch via MCP

Tool: `mcp__58fd8e93-...-get_board_items_page`, args `{ boardId: "1211467504", includeColumns: true, limit: 100, searchTerm: <term> }`.

| searchTerm | Expected count | → dump |
|---|---|---|
| sms | 41 (has_more=false) | items-sms.json (grupo_nuevo62885) |
| reunión | 8 (has_more=false) | items-reuniones.json (grupo_nuevo23254) |
| branding | 3 (has_more=false) | items-branding.json (grupo_nuevo) |

## Dump file shape

```json
{"items":[{"id":"...","name":"...","created_at":"...","updated_at":"...","column_values":[...]}, ...]}
```

Strip `url` from each item. Everything else keeps the MCP response shape the existing importer already handles.

## Code edit — `server/scripts/import-monday.ts`

Extend `SOURCE_TO_MONDAY_GROUP` with:

```ts
'items-newsletter.json': 'grupo_nuevo75562',
'items-sms.json':        'grupo_nuevo62885',
'items-push.json':       'grupo_nuevo25234',
'items-blog.json':       'grupo_nuevo3251',
'items-reuniones.json':  'grupo_nuevo23254',
'items-web.json':        'grupo_nuevo77425',
'items-branding.json':   'grupo_nuevo',
'items-paid.json':       'grupo_nuevo19497',
```

## Deploy sequence

**Laptop, PowerShell, `C:\Users\Eric\Projects\taskr\.claude\worktrees\silly-ardinghelli-9f2f9b\server`:**

```powershell
git add scripts/monday-dump/items-*.json scripts/import-monday.ts
git commit -m "Add newsletter/sms/push/blog/reuniones/web/branding/paid dump files"
git push
$env:DATABASE_URL = "mysql://taskr:82b19124f80e50a354e792f20ebe5bc5@192.168.1.45:3307/taskr"
npx tsx scripts/import-monday.ts
```

No Unraid restart — the importer writes directly to the remote DB. De-dupes by Monday item ID, so safe to re-run.

## Process rule (from feedback this turn)

Read persisted tool-result files **one at a time**, transform → write dump → next. Don't read all 5 in parallel (context bloat).

Suggested order (smallest → largest, then re-fetches):
1. web (75, complete)
2. newsletter (100)
3. push (100)
4. blog (100)
5. paid (100)
6. MCP re-fetch: sms, reunión, branding
7. edit import-monday.ts
8. commit + push + import
