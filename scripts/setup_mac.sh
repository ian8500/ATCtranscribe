#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

info() {
  printf "\033[1;36m%s\033[0m\n" "$1"
}

ok() {
  printf "\033[1;32m%s\033[0m\n" "$1"
}

fail() {
  printf "\033[1;31m%s\033[0m\n" "$1" >&2
  exit 1
}

info "ATCtranscribe Mac setup"

USER_ATC_ADMIN_NAME="${ATC_ADMIN_NAME:-}"
USER_ATC_ADMIN_EMAIL="${ATC_ADMIN_EMAIL:-}"
USER_ATC_ADMIN_PASSWORD="${ATC_ADMIN_PASSWORD:-}"
USER_ATC_CREATE_DEV_ADMIN="${ATC_CREATE_DEV_ADMIN:-}"

command -v python3 >/dev/null 2>&1 || fail "Python 3 is missing. Install Python 3, then rerun ./scripts/setup_mac.sh"
command -v npm >/dev/null 2>&1 || fail "Node/npm is missing. Install Node.js from https://nodejs.org, then rerun ./scripts/setup_mac.sh"

python3 - <<'PY' || fail "Python 3.10+ is required."
import sys
if sys.version_info < (3, 10):
    raise SystemExit(1)
print(f"Python {sys.version.split()[0]} OK")
PY

node_version="$(node --version 2>/dev/null || true)"
npm_version="$(npm --version 2>/dev/null || true)"
ok "Node ${node_version:-unknown} / npm ${npm_version:-unknown} OK"

if [ ! -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  ok "Created .env from .env.example"
else
  ok ".env already exists"
fi

set -a
# shellcheck disable=SC1091
source "$ROOT_DIR/.env"
set +a

if [ -n "$USER_ATC_ADMIN_NAME" ]; then export ATC_ADMIN_NAME="$USER_ATC_ADMIN_NAME"; fi
if [ -n "$USER_ATC_ADMIN_EMAIL" ]; then export ATC_ADMIN_EMAIL="$USER_ATC_ADMIN_EMAIL"; fi
if [ -n "$USER_ATC_ADMIN_PASSWORD" ]; then export ATC_ADMIN_PASSWORD="$USER_ATC_ADMIN_PASSWORD"; fi
if [ -n "$USER_ATC_CREATE_DEV_ADMIN" ]; then export ATC_CREATE_DEV_ADMIN="$USER_ATC_CREATE_DEV_ADMIN"; fi

info "Preparing backend virtual environment"
cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  ok "Created backend/.venv"
else
  ok "backend/.venv already exists"
fi

".venv/bin/python" -m pip install --upgrade pip
".venv/bin/pip" install -r requirements.txt
ok "Backend requirements installed"

info "Preparing frontend packages"
cd "$FRONTEND_DIR"
npm install
ok "Frontend packages installed"

info "Initializing database"
cd "$BACKEND_DIR"
".venv/bin/alembic" upgrade head
".venv/bin/python" seed.py
ok "Database is ready"

cat <<'NEXT'

Setup complete.

Run the app:
  ./scripts/dev_all.sh

Or run services separately:
  ./scripts/run_backend.sh
  ./scripts/run_frontend.sh

If this is your first local run and no admin exists yet, create one explicitly:
  ATC_ADMIN_EMAIL=you@example.com ATC_ADMIN_PASSWORD='use-a-long-password' ./scripts/setup_mac.sh

For throwaway local testing only:
  ATC_CREATE_DEV_ADMIN=true ./scripts/setup_mac.sh

NEXT
