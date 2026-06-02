#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
APP_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"

if [ ! -x "$ROOT_DIR/backend/.venv/bin/uvicorn" ] || [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "Local dependencies are missing. Running setup first..."
  "$ROOT_DIR/scripts/setup_mac.sh"
fi

cleanup() {
  echo
  echo "Stopping ATCtranscribe..."
  if [ -n "${BACKEND_PID:-}" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://${BACKEND_HOST}:${BACKEND_PORT}"
"$ROOT_DIR/scripts/run_backend.sh" &
BACKEND_PID=$!

echo "Starting frontend on ${APP_URL}"
"$ROOT_DIR/scripts/run_frontend.sh" &
FRONTEND_PID=$!

echo
echo "Waiting for the app to become available..."
for _ in $(seq 1 90); do
  if curl -fsS "$APP_URL" >/dev/null 2>&1; then
    echo
    echo "ATCtranscribe is running."
    echo "Open: ${APP_URL}"
    echo "Backend health: http://${BACKEND_HOST}:${BACKEND_PORT}/api/health"
    echo "Press Ctrl-C in this terminal to stop both services."
    if command -v open >/dev/null 2>&1; then
      open "$APP_URL" >/dev/null 2>&1 || true
    fi
    wait "$BACKEND_PID" "$FRONTEND_PID"
    exit 0
  fi
  sleep 1
done

echo "The app did not start within 90 seconds."
echo "Check backend/frontend output above."
exit 1
