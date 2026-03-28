#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if command -v podman >/dev/null 2>&1; then
  CONTAINER_CLI="podman"
elif command -v docker >/dev/null 2>&1; then
  CONTAINER_CLI="docker"
else
  echo "Neither podman nor docker is installed." >&2
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose/amb-compose.yml}"
WEB_PORT="${WEB_PORT:-4333}"
API_PORT="${API_PORT:-4334}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
WAIT_URL="${WAIT_URL:-http://127.0.0.1:${WEB_PORT}}"
export WEB_PORT API_PORT POSTGRES_PORT WAIT_URL

echo "Using container CLI: $CONTAINER_CLI"
echo "Compose file: $COMPOSE_FILE"
echo "Ports: web=$WEB_PORT api=$API_PORT postgres=$POSTGRES_PORT"

"$CONTAINER_CLI" compose -f "$COMPOSE_FILE" pull
"$CONTAINER_CLI" compose -f "$COMPOSE_FILE" up -d

COMPOSE_CMD_DISPLAY="$CONTAINER_CLI compose -f $COMPOSE_FILE"
export COMPOSE_CMD_DISPLAY
sh scripts/wait-for-local-stack.sh
