#!/bin/bash
set -e

echo "=== Deploy triggered at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

cd /app/repo

echo "--- Fetching latest main ---"
git fetch origin main
git reset --hard origin/main

echo "--- Rebuilding app containers ---"
docker compose up -d --build db redis server client tunnel

echo "--- Syncing database schema ---"
# Additive-safe: applies new tables/columns automatically. Intentionally WITHOUT
# --accept-data-loss, so a destructive change FAILS the deploy loudly (set -e)
# instead of silently dropping data — investigate + migrate by hand in that case.
docker compose exec -T server npx prisma db push --skip-generate

echo "=== Deploy finished at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
