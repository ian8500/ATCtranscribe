#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="ATC Investigation Desk"
APP_BUNDLE="$REPO_ROOT/${APP_NAME}.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
BUILD_DIR="$REPO_ROOT/packaging/build"
ICONSET_DIR="$BUILD_DIR/AppIcon.iconset"
LOGO_SVG="$REPO_ROOT/frontend/public/brand/atc-investigation-logo.svg"
ICON_PNG="$BUILD_DIR/logo-1024.png"
ICNS_FILE="$RESOURCES_DIR/AppIcon.icns"

rm -rf "$APP_BUNDLE" "$BUILD_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$ICONSET_DIR"

cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>ATC Investigation Desk</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>local.atctranscribe.investigationdesk</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>ATC Investigation Desk</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/ATC Investigation Desk" <<LAUNCHER
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$REPO_ROOT"
BACKEND_PORT="\${ATC_BACKEND_PORT:-8765}"
FRONTEND_PORT="\${ATC_FRONTEND_PORT:-8766}"
BACKEND_URL="http://127.0.0.1:\${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:\${FRONTEND_PORT}"
LOG_DIR="/tmp/ATCtranscribe"
mkdir -p "\$LOG_DIR"

notify() {
  /usr/bin/osascript -e "display notification \"\$1\" with title \"ATC Investigation Desk\"" >/dev/null 2>&1 || true
}

alert() {
  /usr/bin/osascript -e "display alert \"ATC Investigation Desk\" message \"\$1\"" >/dev/null 2>&1 || true
}

wait_for_url() {
  local url="\$1"
  local attempts="\${2:-60}"
  local i=0
  until /usr/bin/curl -fsS "\$url" >/dev/null 2>&1; do
    i=\$((i + 1))
    if [ "\$i" -ge "\$attempts" ]; then
      return 1
    fi
    sleep 1
  done
}

if ! command -v python3 >/dev/null 2>&1; then
  alert "Python 3 is required. Install Python 3, then open the app again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  alert "Node.js and npm are required. Install Node.js, then open the app again."
  exit 1
fi

if [ -f "\$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "\$REPO_ROOT/.env"
  set +a
fi

cd "\$REPO_ROOT/backend"
if [ ! -x ".venv/bin/python" ]; then
  notify "Preparing backend environment"
  python3 -m venv .venv >> "\$LOG_DIR/setup.log" 2>&1
  .venv/bin/pip install -r requirements.txt >> "\$LOG_DIR/setup.log" 2>&1
fi

.venv/bin/alembic upgrade head >> "\$LOG_DIR/backend.log" 2>&1

if ! /usr/bin/curl -fsS "\$BACKEND_URL/api/health" >/dev/null 2>&1; then
  notify "Starting backend service"
  APP_ENV=development \\
  SECRET_KEY="\${ATC_SECRET_KEY:-desktop-local-secret-change-before-real-recordings-32chars}" \\
  CORS_ORIGINS="\$FRONTEND_URL,http://localhost:\$FRONTEND_PORT" \\
  UPLOAD_DIR="\$REPO_ROOT/backend/uploads" \\
  "\$REPO_ROOT/backend/.venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port "\$BACKEND_PORT" \\
    >> "\$LOG_DIR/backend.log" 2>&1 &
fi

if ! wait_for_url "\$BACKEND_URL/api/health" 90; then
  alert "Backend did not start. Check \$LOG_DIR/backend.log"
  exit 1
fi

cd "\$REPO_ROOT/frontend"
if [ ! -d "node_modules" ]; then
  notify "Preparing frontend environment"
  npm install >> "\$LOG_DIR/setup.log" 2>&1
fi

if ! /usr/bin/curl -fsS "\$FRONTEND_URL" >/dev/null 2>&1; then
  notify "Starting workspace"
  VITE_API_BASE="\$BACKEND_URL" npm run dev -- --host 127.0.0.1 --port "\$FRONTEND_PORT" \\
    >> "\$LOG_DIR/frontend.log" 2>&1 &
fi

if ! wait_for_url "\$FRONTEND_URL" 90; then
  alert "Frontend did not start. Check \$LOG_DIR/frontend.log"
  exit 1
fi

open "\$FRONTEND_URL"
notify "Workspace ready"
LAUNCHER

chmod +x "$MACOS_DIR/ATC Investigation Desk"

if command -v qlmanage >/dev/null 2>&1; then
  qlmanage -t -s 1024 -o "$BUILD_DIR" "$LOGO_SVG" >/dev/null 2>&1 || true
  GENERATED_PNG="$(find "$BUILD_DIR" -maxdepth 1 -name '*.png' -print -quit)"
  if [ -n "${GENERATED_PNG:-}" ]; then
    cp "$GENERATED_PNG" "$ICON_PNG"
  fi
fi

if [ ! -f "$ICON_PNG" ]; then
  python3 "$REPO_ROOT/packaging/make_icon_png.py" "$ICON_PNG"
fi

if [ ! -f "$ICON_PNG" ]; then
  python3 - "$ICON_PNG" <<'PY'
import math
import struct
import sys
import zlib

out = sys.argv[1]
size = 1024
pixels = bytearray([0, 0, 0, 0] * size * size)

def blend(px, py, color):
    if px < 0 or py < 0 or px >= size or py >= size:
        return
    r, g, b, a = color
    i = (py * size + px) * 4
    alpha = a / 255
    inv = 1 - alpha
    pixels[i] = int(r * alpha + pixels[i] * inv)
    pixels[i + 1] = int(g * alpha + pixels[i + 1] * inv)
    pixels[i + 2] = int(b * alpha + pixels[i + 2] * inv)
    pixels[i + 3] = min(255, int(a + pixels[i + 3] * inv))

def rounded_rect(x0, y0, x1, y1, radius, color):
    for y in range(y0, y1):
        for x in range(x0, x1):
            dx = max(x0 + radius - x, 0, x - (x1 - radius - 1))
            dy = max(y0 + radius - y, 0, y - (y1 - radius - 1))
            if dx * dx + dy * dy <= radius * radius:
                blend(x, y, color)

def line(x0, y0, x1, y1, color, width=10):
    steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    radius = width // 2
    for s in range(steps + 1):
        t = s / steps
        x = int(x0 + (x1 - x0) * t)
        y = int(y0 + (y1 - y0) * t)
        for yy in range(y - radius, y + radius + 1):
            for xx in range(x - radius, x + radius + 1):
                if (xx - x) ** 2 + (yy - y) ** 2 <= radius ** 2:
                    blend(xx, yy, color)

def circle(cx, cy, radius, color):
    r2 = radius * radius
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                blend(x, y, color)

def arc(cx, cy, radius, start, end, color, width=10):
    for d in range(start, end):
        rad = math.radians(d)
        x = int(cx + math.cos(rad) * radius)
        y = int(cy + math.sin(rad) * radius)
        circle(x, y, width // 2, color)

rounded_rect(70, 70, 954, 954, 190, (7, 17, 31, 255))
rounded_rect(96, 96, 928, 928, 160, (14, 55, 82, 255))
for y in range(96, 928):
    glow = int(30 * (1 - (y - 96) / 832))
    for x in range(96, 928):
        i = (y * size + x) * 4
        if pixels[i + 3]:
            pixels[i] = min(255, pixels[i] + glow)
            pixels[i + 1] = min(255, pixels[i + 1] + glow)
            pixels[i + 2] = min(255, pixels[i + 2] + glow)

arc(512, 512, 335, 205, 345, (56, 189, 248, 230), 16)
arc(512, 512, 250, 25, 160, (29, 78, 216, 220), 14)
line(512, 290, 512, 730, (224, 242, 254, 245), 36)
line(320, 700, 704, 700, (224, 242, 254, 245), 36)
line(370, 610, 654, 610, (186, 230, 253, 220), 18)
line(410, 520, 614, 520, (186, 230, 253, 200), 18)
line(480, 420, 544, 420, (186, 230, 253, 190), 18)
line(512, 512, 740, 325, (56, 189, 248, 240), 18)
circle(512, 512, 58, (224, 242, 254, 255))
circle(740, 325, 44, (251, 191, 36, 255))
line(205, 420, 300, 365, (147, 197, 253, 240), 22)
line(300, 365, 390, 435, (147, 197, 253, 240), 22)
line(390, 435, 275, 492, (147, 197, 253, 240), 22)
line(275, 492, 205, 420, (147, 197, 253, 240), 22)

rows = []
for y in range(size):
    rows.append(b"\x00" + pixels[y * size * 4 : (y + 1) * size * 4])
raw = b"".join(rows)

def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(raw, 6))
png += chunk(b"IEND", b"")
with open(out, "wb") as handle:
    handle.write(png)
PY
fi

python3 "$REPO_ROOT/packaging/make_icon_png.py" "$ICON_PNG"

if [ -f "$ICON_PNG" ]; then
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$ICON_PNG" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
    sips -z "$((size * 2))" "$((size * 2))" "$ICON_PNG" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"
fi

echo "Created: $APP_BUNDLE"
echo "Logs: /tmp/ATCtranscribe"
