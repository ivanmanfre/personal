#!/usr/bin/env bash
# Build the standalone client board (board-app/) for one hosting target (2026-10-27).
#
#   scripts/build-board-app.sh main   [dist]              ivanmanfredi.com    (deploy.yml build)
#   scripts/build-board-app.sh mirror [dist]              inboundonsteroids.com/client/ (client-mirror)
#   scripts/build-board-app.sh host <swishdm|arch> [out]  <client domain>/board/ (publish-board-host.sh)
#
# board-app/ is its own Vite app (own package.json, own Tailwind) so it never ships inside the
# main bundle. Only the three live boards move to it; every other /client/<slug> (preview and
# demo boards) keeps the classic ClientBoardPage untouched.
#
#   main    board-app at /board-app/ in dist/. Run AFTER `npm run build:prerender` so these
#           files win over anything the prerender wrote for the same slugs:
#             dist/client/risedtc-com/index.html  = the new board
#             dist/client/arch-agency/index.html  = forward to https://madebyarch.com/board/
#             dist/client/swishdm-live/index.html = forward to https://madebyswishdm.com/board/
#           /client/<slug>/classic stays the classic board via 404.html -> SPA restore.
#   mirror  the client-mirror dist is rsynced 1:1 into inboundonsteroids-site client/, so the
#           same layout one level up: dist/board-app/ (base /client/board-app/), dist/<slug>/.
#           /client/<slug>/classic: that site's root 404.html hands /client/* to client/index.html.
#   host    <out>/ = board-app with base /board/, slug locked; <out>/classic/ = the classic
#           board-host bundle with base /board/classic/ (the new board's "classic" link).
#
# Env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (read from .env when unset). They are the only
# values that reach any build: each build runs under `env -i`, and every output is checked by
# scripts/board-secret-guard.mjs (non-anon JWT, sb_secret_, live board tokens, Jekyll-dropped names).
# board-app/ never contains .env files (scripts/sync-board-app.sh excludes them).
set -euo pipefail

TARGET="${1:-}"; shift || true
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
APP="$ROOT/board-app"

# Live boards. Keep in sync with lib/boardHost.ts WHITE_LABEL_BOARDS and BOARD_HOSTS.
NEW_BOARD_SLUGS=(risedtc-com)
FORWARD_SLUGS=(arch-agency swishdm-live)
forward_url() {
  case "$1" in
    arch-agency) echo "https://madebyarch.com/board/" ;;
    swishdm-live) echo "https://madebyswishdm.com/board/" ;;
    *) echo "no forward for $1" >&2; return 1 ;;
  esac
}

usage() { echo "usage: $0 main [dist] | mirror [dist] | host <swishdm|arch> [out]" >&2; exit 2; }
case "$TARGET" in
  main|mirror) OUT="${1:-dist}" ;;
  host)
    HOST="${1:-}"; [ -n "$HOST" ] || usage
    OUT="${2:-dist-board-host}"
    case "$HOST" in
      swishdm) LOCKED="swishdm-live" ;;
      arch) LOCKED="arch-agency" ;;
      *) usage ;;
    esac ;;
  *) usage ;;
esac
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac

[ -f "$APP/package.json" ] || { echo "board-app/ missing (scripts/sync-board-app.sh)" >&2; exit 1; }
# Vite 8 / rolldown need node ^20.19 or >=22.12.
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(!((a===20&&b>=19)||(a===22&&b>=12)||a>22)){console.error("board-app needs node ^20.19 || >=22.12, have "+process.versions.node);process.exit(1)}'

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  [ -f .env ] || { echo "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing" >&2; exit 1; }
  VITE_SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' .env | head -1 | cut -d= -f2-)"
  VITE_SUPABASE_ANON_KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' .env | head -1 | cut -d= -f2-)"
fi

# board-app has its own lockfile; install when node_modules is missing or older than the lock.
if [ ! -f "$APP/node_modules/.package-lock.json" ] || [ "$APP/package-lock.json" -nt "$APP/node_modules/.package-lock.json" ]; then
  (cd "$APP" && env -i PATH="$PATH" HOME="$HOME" npm ci --legacy-peer-deps --no-audit --no-fund)
fi

# build_app <base> [locked-slug] -> board-app/dist
build_app() {
  local base="$1" locked="${2:-}"
  rm -rf "$APP/dist"
  (cd "$APP" && env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production \
    BOARD_BASE="$base" VITE_BOARD_LOCKED_SLUG="$locked" \
    VITE_SUPABASE_URL="$VITE_SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
    npm run build)
  [ -f "$APP/dist/index.html" ] || { echo "board-app build produced no index.html" >&2; exit 1; }
  # The app must be built for this base (BOARD_BASE -> vite base), or every asset 404s.
  grep -q "\"${base}assets/" "$APP/dist/index.html" || {
    echo "board-app index.html does not load assets from ${base}assets/ (BOARD_BASE not applied)" >&2; exit 1; }
  # Boards are private pages: never indexed, wherever they are served.
  if ! grep -qi 'name="robots"' "$APP/dist/index.html"; then
    node -e 'const f=process.argv[1],fs=require("fs");fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(/<head>/i,"<head>\n    <meta name=\"robots\" content=\"noindex, nofollow\" />"))' "$APP/dist/index.html"
  fi
}

# write_forward <file> <url>: static page that forwards keeping ?k= and #ml= exactly.
write_forward() {
  local file="$1" url="$2"
  mkdir -p "$(dirname "$file")"
  cat > "$file" <<HTML
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Content board</title>
<link rel="canonical" href="${url}">
<script>
  // This board moved to its own address. Keep the board link (?k=) and the sign-in link (#ml=).
  (function (l) { l.replace('${url}' + l.search + l.hash); })(window.location);
</script>
<noscript><meta http-equiv="refresh" content="0;url=${url}"></noscript>
</head>
<body>
<p><a id="board" href="${url}">Open the content board</a></p>
<script>document.getElementById('board').href = '${url}' + location.search + location.hash;</script>
</body>
</html>
HTML
}

GUARD=()
case "$TARGET" in
  main|mirror)
    [ -d "$OUT" ] || { echo "$OUT not found: run the main build first" >&2; exit 1; }
    if [ "$TARGET" = main ]; then BASE="/board-app/"; SLUGDIR="$OUT/client"; else BASE="/client/board-app/"; SLUGDIR="$OUT"; fi
    build_app "$BASE"
    rm -rf "$OUT/board-app"
    cp -R "$APP/dist" "$OUT/board-app"
    GUARD+=("$OUT/board-app")
    for s in "${NEW_BOARD_SLUGS[@]}"; do
      mkdir -p "$SLUGDIR/$s"
      cp "$APP/dist/index.html" "$SLUGDIR/$s/index.html"
      GUARD+=("$SLUGDIR/$s/index.html")
    done
    for s in "${FORWARD_SLUGS[@]}"; do
      write_forward "$SLUGDIR/$s/index.html" "$(forward_url "$s")"
      GUARD+=("$SLUGDIR/$s/index.html")
    done
    ;;
  host)
    build_app "/board/" "$LOCKED"
    rm -rf "$OUT"; mkdir -p "$OUT"
    cp -R "$APP/dist/." "$OUT/"
    # Classic board for the same slug at /board/classic/ (the new board links there).
    env -i PATH="$PATH" HOME="$HOME" BOARD_HOST="$HOST" BOARD_HOST_BASE="/board/classic/" BOARD_HOST_OUT="$OUT/classic" \
      VITE_SUPABASE_URL="$VITE_SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
      npx vite build --config vite.board-host.config.ts
    [ -f "$OUT/classic/index.html" ] || { echo "classic board build produced no index.html" >&2; exit 1; }
    GUARD+=("$OUT")
    ;;
esac

node "$ROOT/scripts/board-secret-guard.mjs" "${GUARD[@]}"
echo "board-app $TARGET${HOST:+ $HOST} -> $OUT"
