#!/usr/bin/env bash
# Publish a white-label client board to the client's own domain (2026-10-15; board-app 2026-10-27).
#
#   scripts/publish-board-host.sh <host> [--push]
#
#   host    swishdm (madebyswishdm.com/board) | arch (madebyarch.com/board); keys of
#           vite.board-host.config.ts BOARD_HOSTS
#   --push  commit + `git push origin main` in the client's site repo (its Pages build then
#           deploys). Without it the synced checkout is left for review.
#
# Builds with scripts/build-board-app.sh host <host>: <host>/board/ = the standalone board
# (board-app/, slug locked), <host>/board/classic/ = the classic board-host bundle. Then syncs
# that into <repo>/<dir>/, keeping the last two releases' hashed assets (cached index.html).
# Everything else in the client's repo (homepage, resources, audit pages) is untouched; the
# one exception is a missing root 404.html, which is seeded once (never overwritten) so stray
# /board/... paths return to /board/. Runs locally and in CI (.github/workflows/deploy.yml
# swishdm-board-mirror, arch-board-mirror).
#
# Env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (read from .env when unset; only those
# two are ever passed to the build). In CI, MIRROR_PUSH_TOKEN authenticates the clone.
set -euo pipefail

HOST="${1:-}"; shift || true
PUSH=0; [ "${1:-}" = "--push" ] && PUSH=1

# SEED_404: root 404.html written only when the repo has none (madebyarch.com had no custom 404;
# swishdm-resources already ships site/404.html).
SEED_404=""
case "$HOST" in
  swishdm) REPO="ivanmanfre/swishdm-resources"; DIR="site/board"; URL="https://madebyswishdm.com/board/" ;;
  arch) REPO="ivanmanfre/madebyarch"; DIR="board"; URL="https://madebyarch.com/board/"; SEED_404="404.html" ;;
  *) echo "usage: $0 <swishdm|arch> [--push]" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  [ -f .env ] || { echo "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing" >&2; exit 1; }
  VITE_SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' .env | head -1 | cut -d= -f2-)"
  VITE_SUPABASE_ANON_KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' .env | head -1 | cut -d= -f2-)"
fi

export VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY
# Scrubbed-env builds + the secret guard live in build-board-app.sh.
OUT="$ROOT/dist-board-host"
bash "$ROOT/scripts/build-board-app.sh" host "$HOST" "$OUT"
[ -f "$OUT/index.html" ] && [ -f "$OUT/classic/index.html" ] || { echo "build incomplete" >&2; exit 1; }

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
  # Sparse, blobless, shallow: madebyarch is >1 GB of audit pages; only the board folder,
  # the release ledger and root files (404.html) are ever touched.
  git clone -q --depth 1 --filter=blob:none --sparse --branch main "$CLONE_URL" "$WORK"
  git -C "$WORK" sparse-checkout set "$DIR" ".board-releases"
fi

# Pages/CDN caches index.html for ~10 minutes, so a cached index can still ask for the
# previous release's hashed chunks. Keep the last two releases' assets per asset folder
# (board-app at assets/, classic board at classic/assets/); prune older ones.
# --checksum: index.html keeps the same size between releases and a fresh clone can share
# its mtime to the second, so rsync's size+mtime check would skip the new index.
mkdir -p "$WORK/$DIR"
rsync -a --checksum --exclude assets "$OUT/" "$WORK/$DIR/"
for SUB in assets classic/assets; do
  [ -d "$OUT/$SUB" ] || continue
  case "$SUB" in
    assets) REL="$WORK/.board-releases/$HOST" ;;
    classic/assets) REL="$WORK/.board-releases/$HOST-classic" ;;
  esac
  mkdir -p "$REL" "$WORK/$DIR/$SUB"
  # First run: whatever is live now counts as the previous release.
  [ -f "$REL/prev1" ] || ls "$WORK/$DIR/$SUB" > "$REL/prev1"
  ls "$OUT/$SUB" > "$REL/new"
  { cat "$REL/new"; cat "$REL/prev1" "$REL/prev2" 2>/dev/null || true; } | sort -u > "$REL/keep"
  rsync -a --checksum "$OUT/$SUB/" "$WORK/$DIR/$SUB/"
  for f in "$WORK/$DIR/$SUB/"*; do
    grep -qxF "$(basename "$f")" "$REL/keep" || rm -f "$f"
  done
  if ! cmp -s "$REL/new" "$REL/prev1"; then
    [ -f "$REL/prev1" ] && mv "$REL/prev1" "$REL/prev2"
    mv "$REL/new" "$REL/prev1"
  fi
  rm -f "$REL/new" "$REL/keep"
done

# Root 404 for a client site that has none: a stray /board/... path goes back to the board with
# its ?k= and #ml=; any other unknown path gets a plain noindex not-found page (status stays 404).
if [ -n "$SEED_404" ] && [ ! -e "$WORK/$SEED_404" ]; then
  case "$HOST" in
    arch) cat > "$WORK/$SEED_404" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>ARCH.</title>
<script>
  // A stray path under /board/ goes back to the board, keeping its board link (?k=) and sign-in link (#ml=).
  (function (l) { if (/^\/board(\/|$)/i.test(l.pathname) && l.pathname !== '/board/') l.replace('/board/' + l.search + l.hash); })(window.location);
</script>
<style>html,body{margin:0;height:100%;background:#000F41;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui,sans-serif}div{text-align:center}span{display:inline-block;background:#F2FF82;color:#000F41;font-weight:700;font-size:28px;letter-spacing:.02em;padding:14px 30px;border-radius:80px}p{color:#fff;opacity:.55;font-size:14px;margin-top:18px}</style>
</head><body><div><span>ARCH.</span><p>Page not found</p></div></body></html>
HTML
    ;;
    *) echo "no 404 template for $HOST" >&2; exit 1 ;;
  esac
  git -C "$WORK" add "$SEED_404"
fi

cd "$WORK"
git add -A "$DIR" .board-releases
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
