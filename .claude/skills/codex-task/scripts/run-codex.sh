#!/bin/sh
# Run one Codex task non-interactively, in its own clone of the repository.
#
#   run-codex.sh <label> <branch> <spec-file> [base]
#
#   label      short name for the run (letters, digits, -): the clone is $CODEX_WORK/cx-<label>
#   branch     the branch Codex works on. Checked out when it exists on origin; otherwise created from origin/<base>.
#              A branch that exists only locally (not pushed) is refused: push it first.
#   spec-file  the prompt (the task spec, or a one-line pointer to an Issue / PR comment)
#   base       the base for a new branch (default main; a stacked PR names the branch below it)
#
# CODEX_WORK   where clones, logs and reports go (default: ${TMPDIR:-/tmp}/codex-work). Give Claude's scratchpad.
# CODEX_EFFORT reasoning effort (default high; without it this host's Codex runs at "none", as its log header shows).
# Output: $CODEX_WORK/codex-<label>.report.json (the final report, report.schema.json) and codex-<label>.log (progress).
# Exit 0 only when Codex exited 0 and wrote a report. Run it in the background and read the report when it ends.
set -eu
label=$1; br=$2; spec=$3; base=${4:-main}
case $label in *[!A-Za-z0-9-]*|'') echo "bad label: $label" >&2; exit 2 ;; esac
[ -r "$spec" ] || { echo "no spec file: $spec" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
repo_git=$(git -C "$here" rev-parse --path-format=absolute --git-common-dir)
url=$(git -C "$here" remote get-url origin)
work=${CODEX_WORK:-${TMPDIR:-/tmp}/codex-work}
d="$work/cx-$label"
report="$work/codex-$label.report.json"; log="$work/codex-$label.log"
mkdir -p "$work"

# one run per label at a time
lock="$work/cx-$label.lock"
mkdir "$lock" 2>/dev/null || { echo "a run with label $label is in progress ($lock); use another label" >&2; exit 2; }
trap 'rmdir "$lock" 2>/dev/null' EXIT
# an earlier clone with the same label: never throw away work that is not on origin
if [ -d "$d/.git" ]; then
  git -C "$d" fetch -q origin 2>/dev/null || true
  if [ -n "$(git -C "$d" status --porcelain 2>/dev/null | head -1)" ] ||
     [ -n "$(git -C "$d" log --oneline --branches --not --remotes=origin 2>/dev/null | head -1)" ]; then
    echo "$d has uncommitted changes or commits that are not on origin; push or remove them, or use another label" >&2; exit 2
  fi
fi
rm -rf "$d" "$report" "$log"
git clone -q --reference "$repo_git" "$url" "$d"
if git -C "$d" ls-remote --exit-code origin "refs/heads/$br" >/dev/null 2>&1; then
  git -C "$d" checkout -q "$br"
elif git -C "$here" rev-parse --verify -q "refs/heads/$br" >/dev/null; then
  echo "branch $br exists locally but not on origin: push it first" >&2; exit 2
else
  git -C "$d" checkout -q -b "$br" "origin/$base"
fi

# pnpm: Codex gets its own store under $work (the user's store is hard-linked into every checkout's node_modules, so writing it
# from the sandbox would change files that run outside it), and the pinned pnpm is installed here, outside the sandbox, so that
# Codex never needs to write the package-manager store (whose pnpm also runs outside the sandbox).
export pnpm_config_store_dir="$work/pnpm-store"
(cd "$d" && pnpm --version >/dev/null 2>&1) || true
# Writable roots besides the clone and $work's /tmp: the clone's .git (workspace-write keeps .git read-only unless it is named),
# and pnpm's locks in $XDG_RUNTIME_DIR.
set -- --add-dir "$d/.git"
case $work in /tmp/*|"${TMPDIR:-/tmp}"/*) ;; *) set -- "$@" --add-dir "$work" ;; esac
if [ -n "${XDG_RUNTIME_DIR:-}" ]; then
  uid=$(id -u)
  for l in "$XDG_RUNTIME_DIR/pnpm-store-operation-locks-$uid" "$XDG_RUNTIME_DIR/pnpm-dir-locks-$uid"; do
    mkdir -p "$l" && set -- "$@" --add-dir "$l"
  done
fi
# npm (a test fixture's `npm install`) writes its cache under $HOME, which is read-only: keep it beside the clone
export npm_config_cache="$work/npm-cache-$label"
# Playwright's install script would download browsers into ~/.cache/ms-playwright (read-only here); the installed ones are only read
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

set +e
codex exec -s workspace-write \
  -c sandbox_workspace_write.network_access=true \
  -c model_reasoning_effort="${CODEX_EFFORT:-high}" \
  "$@" \
  --output-schema "$here/report.schema.json" \
  -o "$report" \
  -C "$d" - <"$spec" >"$log" 2>&1
rc=$?
set -e
echo "exit=$rc label=$label clone=$d"
if [ "$rc" -eq 0 ] && [ -s "$report" ]; then cat "$report"; exit 0; fi
echo "FAILED: codex exited $rc$( [ -s "$report" ] || echo ', no report' ). Last lines of $log:"
tail -c 3000 "$log"
exit $(( rc == 0 ? 1 : rc ))
