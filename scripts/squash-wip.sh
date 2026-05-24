#!/bin/bash
# Squash-merge all unmerged WIP branches for the current repo into a target branch.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
REPO_URL=$(git remote get-url origin)
SUPA_URL="${SUPABASE_URL:-https://bjbvqvzbzczjbatgmccb.supabase.co}"
SUPA_KEY="${SUPABASE_SERVICE_KEY:?Set SUPABASE_SERVICE_KEY (find via railway variables --service claude-code-railway)}"

H=(-H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY")
ENCODED_REPO=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$REPO_URL")

echo "Fetching unmerged WIP branches for $REPO_URL..."
WIPS=$(curl -s "${H[@]}" "$SUPA_URL/rest/v1/wip_branches?repo=eq.$ENCODED_REPO&merged=eq.false&order=created_at.desc&select=branch,host,created_at")

count=$(echo "$WIPS" | jq 'length')
if [ "$count" = "0" ]; then echo "No unmerged WIP branches."; exit 0; fi

echo "$WIPS" | jq -r '.[] | "\(.created_at)  [\(.host)]  \(.branch)"'

echo
read -p "Target branch to squash these into [main]: " TARGET
TARGET="${TARGET:-main}"

read -p "Proceed? [y/N] " CONFIRM
[ "$CONFIRM" != "y" ] && { echo "Aborted."; exit 0; }

git fetch origin --prune --quiet
git checkout "$TARGET"
git pull --ff-only origin "$TARGET"

# Reverse order so oldest WIP merges first
echo "$WIPS" | jq -r '.[].branch' | tail -r | while read -r BR; do
  echo "Squashing $BR..."
  git merge --squash "origin/$BR" || { echo "Conflict in $BR — resolve manually."; exit 1; }
  git commit -m "squash: $BR"
  ENCODED_BR=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$BR")
  curl -s -X PATCH "${H[@]}" -H "Content-Type: application/json" \
    "$SUPA_URL/rest/v1/wip_branches?branch=eq.$ENCODED_BR" \
    -d "{\"merged\":true,\"merged_at\":\"$(date -u +%FT%TZ)\",\"merged_into\":\"$TARGET\"}" >/dev/null
done

echo "Pushing $TARGET..."
git push origin "$TARGET"

echo "Deleting remote WIP branches..."
echo "$WIPS" | jq -r '.[].branch' | while read -r BR; do
  git push origin --delete "$BR" 2>/dev/null || echo "  (couldn't delete $BR)"
done

echo "Done."
