#!/bin/sh
# Run one Codex task non-interactively, in its own clone (Codex's sandbox keeps .git read-only in a shared worktree).
#
#   run-codex.sh <label> <branch> <spec-file> [base]
#
#   label      short name for the run (letters, digits, -): the clone is $CODEX_WORK/cx-<label>
#   branch     the branch Codex works on. It is checked out when it exists on origin; otherwise it is created from origin/<base>
#   spec-file  the prompt (the task spec, or a one-line pointer to an Issue / PR comment)
#   base       default main
#
# CODEX_WORK   where clones, logs and reports go (default: ${TMPDIR:-/tmp}/codex-work). Give Claude's scratchpad.
# Output: $CODEX_WORK/codex-<label>.report.json (the final report, report.schema.json), codex-<label>.log (progress).
# Exit status is Codex's. Run it in the background and read the report when it ends.
set -eu
label=$1; br=$2; spec=$3; base=${4:-main}
case $label in *[!A-Za-z0-9-]*|'') echo "bad label: $label" >&2; exit 2 ;; esac
[ -r "$spec" ] || { echo "no spec file: $spec" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
repo_git=$(git -C "$here" rev-parse --path-format=absolute --git-common-dir)
url=$(git -C "$here" remote get-url origin)
work=${CODEX_WORK:-${TMPDIR:-/tmp}/codex-work}
d="$work/cx-$label"
mkdir -p "$work"
rm -rf "$d"
git clone -q --reference "$repo_git" "$url" "$d"
if git -C "$d" ls-remote --exit-code --heads origin "$br" >/dev/null 2>&1; then
  git -C "$d" checkout -q "$br"
else
  git -C "$d" checkout -q -b "$br" "origin/$base"
fi
store=$(pnpm store path 2>/dev/null || true)
set +e
codex exec -s workspace-write \
  -c sandbox_workspace_write.network_access=true \
  ${store:+--add-dir "$store"} \
  --output-schema "$here/report.schema.json" \
  -o "$work/codex-$label.report.json" \
  -C "$d" - <"$spec" >"$work/codex-$label.log" 2>&1
rc=$?
echo "exit=$rc label=$label clone=$d"
cat "$work/codex-$label.report.json" 2>/dev/null || tail -c 3000 "$work/codex-$label.log"
exit $rc
