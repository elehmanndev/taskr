#!/bin/bash
set -e

if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
  echo "ERROR: GITHUB_WEBHOOK_SECRET is not set"
  exit 1
fi

envsubst '${GITHUB_WEBHOOK_SECRET}' \
  < /etc/webhook/hooks.json.template \
  > /etc/webhook/hooks.json

exec webhook -hooks /etc/webhook/hooks.json -verbose -port 9000 -ip 0.0.0.0
