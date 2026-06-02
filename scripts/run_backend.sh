#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
ATC_RELOAD="${ATC_RELOAD:-false}"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
ATC_RELOAD="${ATC_RELOAD:-false}"

if [ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]; then
  echo "Backend environment is missing. Run ./scripts/setup_mac.sh first."
  exit 1
fi

cd "$BACKEND_DIR"
echo "Starting ATCtranscribe backend..."
echo "API: http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "Health: http://${BACKEND_HOST}:${BACKEND_PORT}/api/health"
echo
".venv/bin/alembic" upgrade head
if [ "$ATC_RELOAD" = "true" ]; then
  exec ".venv/bin/uvicorn" app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
fi

exec ".venv/bin/uvicorn" app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT"
