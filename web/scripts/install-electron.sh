#!/usr/bin/env bash
set -euo pipefail

WEB_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB_ROOT"

if [ ! -f node_modules/electron/package.json ]; then
  echo "[electron] npm install electron…"
  npm install electron
fi

VERSION="$(node -p "require('./node_modules/electron/package.json').version")"
PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$PLATFORM" in
  darwin) PLATFORM=darwin ;;
  linux) PLATFORM=linux ;;
  mingw*|msys*|cygwin*|windows*) PLATFORM=win32 ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64) EARCH=arm64 ;;
  x86_64|amd64) EARCH=x64 ;;
  *)
    echo "[electron] Неподдерживаемая архитектура: $ARCH" >&2
    exit 1
    ;;
esac

if [ "$PLATFORM" = "darwin" ] && [ "$EARCH" = "x64" ]; then
  if sysctl -in sysctl.proc_translated 2>/dev/null | grep -q '^1$'; then
    EARCH=arm64
  fi
fi

ZIP_NAME="electron-v${VERSION}-${PLATFORM}-${EARCH}.zip"
if [ -n "${ELECTRON_MIRROR:-}" ]; then
  URL="${ELECTRON_MIRROR%/}/${VERSION}/${ZIP_NAME}"
else
  URL="https://github.com/electron/electron/releases/download/v${VERSION}/${ZIP_NAME}"
fi

DIST_DIR="$WEB_ROOT/node_modules/electron/dist"
PATH_FILE="$WEB_ROOT/node_modules/electron/path.txt"
TMP_ZIP="$(mktemp /tmp/electron-XXXXXX.zip)"

cleanup() {
  rm -f "$TMP_ZIP"
}
trap cleanup EXIT

echo "[electron] Скачиваю ${ZIP_NAME}…"
echo "[electron] $URL"
if ! curl -fL --connect-timeout 30 --max-time 600 --retry 3 --retry-delay 2 -o "$TMP_ZIP" "$URL"; then
  if [ -z "${ELECTRON_MIRROR:-}" ]; then
    URL="https://npmmirror.com/mirrors/electron/${VERSION}/${ZIP_NAME}"
    echo "[electron] GitHub недоступен, пробую зеркало…"
    echo "[electron] $URL"
    curl -fL --connect-timeout 30 --max-time 600 --retry 3 --retry-delay 2 -o "$TMP_ZIP" "$URL"
  else
    exit 1
  fi
fi

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
unzip -q "$TMP_ZIP" -d "$DIST_DIR"

case "$PLATFORM" in
  darwin) REL_PATH="Electron.app/Contents/MacOS/Electron" ;;
  win32) REL_PATH="electron.exe" ;;
  *) REL_PATH="electron" ;;
esac

if [ ! -e "$DIST_DIR/$REL_PATH" ]; then
  echo "[electron] После распаковки не найден: $DIST_DIR/$REL_PATH" >&2
  exit 1
fi

printf '%s' "$REL_PATH" > "$PATH_FILE"
echo "[electron] Готово: $DIST_DIR/$REL_PATH"
