#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if command -v docker >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v podman >/dev/null 2>&1; then
  COMPOSE="podman compose"
else
  echo "Neither docker nor podman is installed." >&2
  exit 1
fi

ENV_FILE="${ENV_FILE:-deploy/compose/.env.hosting}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose/docker-compose.hosting.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE" >&2
  echo "Create it from deploy/compose/.env.hosting.example" >&2
  exit 1
fi

echo "[hosting] using: $COMPOSE"
echo "[hosting] env file: $ENV_FILE"
echo "[hosting] compose file: $COMPOSE_FILE"

$COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
$COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

echo "[hosting] waiting for API health"
attempt=0
max_attempts=30
until $COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T api wget -qO- http://localhost:3334/api/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[hosting] API health check failed" >&2
    exit 1
  fi
  sleep 2
done

echo "[hosting] deployment finished"
echo "[hosting] dashboard: https://$(awk -F= '/^WEB_DOMAIN=/{print $2}' "$ENV_FILE")"
echo "[hosting] api base: https://$(awk -F= '/^API_DOMAIN=/{print $2}' "$ENV_FILE")/api"
echo "[hosting] note: Swagger /api/docs is off when NODE_ENV=production unless AMB_SWAGGER_ENABLED=true"
