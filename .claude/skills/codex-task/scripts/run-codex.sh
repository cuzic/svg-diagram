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
# the label is part of TMPDIR, where Chromium makes Unix sockets (path limit ~107 bytes): keep it short
[ ${#label} -le 24 ] || { echo "label too long (24 at most): $label" >&2; exit 2; }
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
tmp=""
trap 'rmdir "$lock" 2>/dev/null; [ -n "$tmp" ] && rm -rf "$tmp"' EXIT
trap 'exit 130' INT TERM
# An earlier clone with the same label is moved aside, never deleted and never touched by git here: the sandbox could write its
# .git/config (core.fsmonitor, an ext:: remote ...), which git would run outside the sandbox. Look into it, then delete it by hand.
if [ -e "$d" ]; then
  old="$d.old-$(date +%Y%m%d%H%M%S)"
  mv "$d" "$old"
  echo "moved the previous clone to $old (it may hold unpushed work; delete it when done)" >&2
fi
rm -f "$report" "$log"
git clone -q --reference "$repo_git" "$url" "$d"
if git -C "$d" ls-remote --exit-code origin "refs/heads/$br" >/dev/null 2>&1; then
  git -C "$d" checkout -q "$br"
elif git -C "$here" rev-parse --verify -q "refs/heads/$br" >/dev/null; then
  echo "branch $br exists locally but not on origin: push it first" >&2; exit 2
else
  git -C "$d" checkout -q -b "$br" "origin/$base"
fi

# A branch that carries Codex or pnpm configuration is refused: Codex trusts the clone path and would load .codex/, and
# .pnpmfile.cjs runs on every pnpm command (inside the sandbox for Codex, but outside it for anyone who later runs pnpm there).
for f in .codex .pnpmfile.cjs; do
  [ -e "$d/$f" ] && { echo "the branch has $f: refusing to run Codex on it (review and remove it first)" >&2; exit 2; }
done
# pnpm: Codex gets its own store under $work (the user's store is hard-linked into every checkout's node_modules, so writing it
# from the sandbox would change files that run outside it). The pinned pnpm is installed here, outside the sandbox, from a
# directory that holds only the packageManager field (not the branch's files), so Codex never writes the package-manager store.
export pnpm_config_store_dir="$work/pnpm-store"
pm=$(node -e 'process.stdout.write(require(process.argv[1]).packageManager ?? "")' "$d/package.json" 2>/dev/null || true)
case $pm in pnpm@[0-9]*.[0-9]*.[0-9]*) case $pm in *[!A-Za-z0-9@.+-]*) pm= ;; esac ;; *) pm= ;; esac  # only a plain pnpm@x.y.z[+sha...] goes into the warm-up
if [ -n "$pm" ]; then
  warm="$work/pm-warm"; mkdir -p "$warm"
  printf '{"packageManager":"%s"}\n' "$pm" >"$warm/package.json"
  (cd "$warm" && pnpm --version >/dev/null 2>&1) || true
fi
# Writable roots: the clone (the workdir), and only these besides it. /tmp and $TMPDIR are NOT writable (old clones there hold
# hard links into the user's pnpm store and other checkouts), so each run gets its own TMPDIR.
# (a short path: Chromium puts Unix sockets in it, and a socket path longer than ~107 bytes makes it crash)
tmp=$(mktemp -d "/tmp/cx-$label.XXXXXX"); mkdir -p "$work/pnpm-store" "$work/npm-cache-$label"
export TMPDIR="$tmp"
set -- --add-dir "$d/.git" --add-dir "$tmp" --add-dir "$work/pnpm-store" --add-dir "$work/npm-cache-$label"
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
  -c sandbox_workspace_write.exclude_slash_tmp=true \
  -c sandbox_workspace_write.exclude_tmpdir_env_var=true \
  -c shell_environment_policy.set.TMPDIR="\"$tmp\"" \
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
