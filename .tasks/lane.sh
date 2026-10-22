#!/bin/bash
# usage: lane.sh <lane> <spec> [spec...] : own worktree+branch; Codex runs specs in order; commits only on gate pass.
L=$1; shift; REPO="/mnt/windows_d/projects/BTD6 CLONE"; W="/mnt/windows_d/projects/BTD6-lanes/$L"
cd "$REPO" || exit 1
[ -d "$W" ] || git worktree add -q -b "lane/$L" "$W" main || exit 1
ln -sfn "$REPO/node_modules" "$W/node_modules"; mkdir -p "$W/.tasks"; cp "$REPO"/.tasks/*.md "$W/.tasks/" 2>/dev/null
cd "$W"; LOG="$REPO/.tasks/lane-$L.log"
gate(){ npx tsc >/dev/null 2>&1 && npx vitest run >/dev/null 2>&1 && npx vite build >/dev/null 2>&1; }
for t in "$@"; do
  echo "$(date +%T) start $t" >> "$LOG"
  codex exec --sandbox workspace-write --skip-git-repo-check -C "$W" "Follow the instructions in .tasks/$t.md exactly. Work only inside this directory." < /dev/null > "$REPO/.tasks/$L-$t.log" 2>&1
  if ! gate; then
    codex exec --sandbox workspace-write --skip-git-repo-check -C "$W" "The gate (npx tsc && npx vitest run && npx vite build) fails after task $t. Fix without weakening or deleting tests. 3-line final message." < /dev/null > "$REPO/.tasks/$L-$t.fix.log" 2>&1
    gate || { echo "$(date +%T) STOP $t gate failed" >> "$LOG"; exit 1; }
  fi
  git add -A && git -c user.name=kaden -c user.email=kaden.prince09@icloud.com commit -q -m "$t (lane $L, Codex)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
  echo "$(date +%T) done $t" >> "$LOG"
done
echo "$(date +%T) lane $L complete" >> "$LOG"
