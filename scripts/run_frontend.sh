#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
VITE_API_BASE="${VITE_API_BASE:-http://${BACKEND_HOST}:${BACKEND_PORT}}"

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Frontend packages are missing. Run ./scripts/setup_mac.sh first."
  exit 1
fi

cd "$FRONTEND_DIR"
echo "Starting ATCtranscribe frontend..."
echo "App: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "API: ${VITE_API_BASE}"
echo
exec env VITE_API_BASE="$VITE_API_BASE" npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
