#!/bin/bash
set -e

echo "=== Deploy triggered at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

cd /app/repo

echo "--- Fetching latest main ---"
git fetch origin main
git reset --hard origin/main

echo "--- Rebuilding app containers ---"
docker compose up -d --build db redis server client tunnel

echo "=== Deploy finished at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
