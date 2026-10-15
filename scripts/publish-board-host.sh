#!/usr/bin/env bash
# Publish a white-label client board to the client's own domain (2026-10-15).
#
#   scripts/publish-board-host.sh <host> [--push]
#
#   host    key in vite.board-host.config.ts BOARD_HOSTS (today: swishdm)
#   --push  commit + `git push origin main` in the client's site repo (its Pages
#           workflow then deploys). Without it the synced checkout is left for review.
#
# Builds ONLY the board (npm run build:board-host, slug locked at build time), then
# rsyncs dist-board-host/ into <repo>/<dir>/ with --delete, so stale hashed assets go.
# Everything else in the client's repo (homepage redirect, 404.html, resources) is
# untouched. Runs locally and in CI (.github/workflows/deploy.yml swishdm-board-mirror).
#
# Env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (read from .env when unset; only those
# two are ever passed to the build). In CI, MIRROR_PUSH_TOKEN authenticates the clone.
set -euo pipefail

HOST="${1:-}"; shift || true
PUSH=0; [ "${1:-}" = "--push" ] && PUSH=1

case "$HOST" in
  swishdm) REPO="ivanmanfre/swishdm-resources"; DIR="site/board"; URL="https://madebyswishdm.com/board/" ;;
  *) echo "usage: $0 <swishdm> [--push]" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  [ -f .env ] || { echo "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing" >&2; exit 1; }
  VITE_SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' .env | head -1 | cut -d= -f2-)"
  VITE_SUPABASE_ANON_KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' .env | head -1 | cut -d= -f2-)"
fi

# Build with a scrubbed env: nothing but the two public values reaches vite.
env -i PATH="$PATH" HOME="$HOME" BOARD_HOST="$HOST" \
  VITE_SUPABASE_URL="$VITE_SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  npx vite build --config vite.board-host.config.ts

[ -f dist-board-host/index.html ] || { echo "build produced no index.html" >&2; exit 1; }
# Guard: the only key allowed in the bundle is the public anon JWT.
node -e '
const fs=require("fs"),p=require("path");let bad=[];
const walk=(d)=>{for(const f of fs.readdirSync(d)){const q=p.join(d,f);if(fs.statSync(q).isDirectory())walk(q);else{const s=fs.readFileSync(q,"utf8");
if(/sb_secret_/.test(s))bad.push(q+": sb_secret_");
for(const m of s.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)){let r="?";try{r=JSON.parse(Buffer.from(m[1],"base64url").toString()).role}catch{}if(r!=="anon")bad.push(q+": jwt role "+r)}}}};
walk("dist-board-host");if(bad.length){console.error("secret in build:",bad);process.exit(1)}'

WORK="${BOARD_HOST_WORKDIR:-${HOME}/.local/state/board-host-publish/$HOST}"
if [ -n "${MIRROR_PUSH_TOKEN:-}" ]; then
  CLONE_URL="https://x-access-token:${MIRROR_PUSH_TOKEN}@github.com/${REPO}.git"
else
  CLONE_URL="https://github.com/${REPO}.git"
fi
if [ -d "$WORK/.git" ]; then
  git -C "$WORK" fetch -q origin main
  git -C "$WORK" checkout -q main
  git -C "$WORK" rebase -q origin/main   # keeps any local, not-yet-pushed commit
else
  rm -rf "$WORK"; mkdir -p "$(dirname "$WORK")"
  git clone -q --depth 1 --branch main "$CLONE_URL" "$WORK"
fi

mkdir -p "$WORK/$DIR/assets"
# Pages/CDN caches index.html for ~10 minutes, so a cached index can still ask for the
# previous release's hashed chunks. Keep the last two releases' assets; prune older ones.
REL="$WORK/.board-releases/$HOST"; mkdir -p "$REL"
# First run: whatever is live now counts as the previous release.
[ -f "$REL/prev1" ] || ls "$WORK/$DIR/assets" > "$REL/prev1"
ls dist-board-host/assets > "$REL/new"
cat "$REL/new" "$REL/prev1" "$REL/prev2" 2>/dev/null | sort -u > "$REL/keep"
rsync -a --exclude assets dist-board-host/ "$WORK/$DIR/"
rsync -a dist-board-host/assets/ "$WORK/$DIR/assets/"
for f in "$WORK/$DIR/assets/"*; do
  grep -qxF "$(basename "$f")" "$REL/keep" || rm -f "$f"
done
if ! cmp -s "$REL/new" "$REL/prev1"; then
  [ -f "$REL/prev1" ] && mv "$REL/prev1" "$REL/prev2"
  mv "$REL/new" "$REL/prev1"
fi
rm -f "$REL/new" "$REL/keep"

cd "$WORK"
git add -A "$DIR" ".board-releases/$HOST"
if git diff --cached --quiet; then echo "board host $HOST unchanged"; exit 0; fi
SRC="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local)"
git -c user.name="board-host-bot" -c user.email="noreply@ivanmanfredi.com" commit -q -m "board: sync from personal-site ${SRC}"
git --no-pager show --stat --format='%h %s' HEAD | head -20

if [ "$PUSH" = 1 ]; then
  for i in 1 2 3 4 5; do
    git push -q origin HEAD:main && { echo "pushed; Pages will serve $URL"; exit 0; }
    git pull -q --rebase origin main
  done
  git push origin HEAD:main
else
  echo "synced into $WORK (not pushed; re-run with --push)"
fi
