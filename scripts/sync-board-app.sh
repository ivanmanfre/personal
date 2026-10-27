#!/usr/bin/env bash
# Re-vendor the standalone client board app (board-next) into board-app/ (2026-10-27).
#
#   scripts/sync-board-app.sh [source-dir]     default source: ~/Desktop/board-next
#
# board-app/ is a separate Vite + React + Tailwind app with its own package.json. It is
# never imported by the main site; scripts/build-board-app.sh builds it on its own.
# Copies source only. Never copies .env* (board-next/.env.local holds full-power board
# tokens), node_modules, dist, .git or build caches. --delete keeps board-app/ an exact
# mirror of the source, but leaves the excluded paths (a local board-app/node_modules) alone.
set -euo pipefail

SRC="${1:-$HOME/Desktop/board-next}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/board-app"

[ -f "$SRC/package.json" ] || { echo "no package.json in $SRC" >&2; exit 1; }
[ -f "$SRC/package-lock.json" ] || { echo "no package-lock.json in $SRC (npm ci needs it)" >&2; exit 1; }
mkdir -p "$DEST"

rsync -a --delete \
  --exclude '.env' --exclude '.env.*' --exclude '*.local' \
  --exclude 'node_modules/' --exclude 'dist/' --exclude 'dist-*/' --exclude '.git/' \
  --exclude '*.tsbuildinfo' --exclude '.DS_Store' --exclude '.vite/' \
  "$SRC/" "$DEST/"

# Belt and braces: nothing env-like or token-like may land in the vendored copy.
if find "$DEST" -path "$DEST/node_modules" -prune -o \( -name '.env*' -o -name '*.local' \) -print | grep -q .; then
  echo "env file found in $DEST; refusing" >&2; exit 1
fi
node "$ROOT/scripts/board-secret-guard.mjs" --source "$DEST"

SHA="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unknown)"
DIRTY="$(git -C "$SRC" status --porcelain 2>/dev/null | grep -c . || true)"
echo "board-app synced from $SRC @ $SHA (uncommitted files in source: $DIRTY)"
git -C "$ROOT" status --short -- board-app | head -40
