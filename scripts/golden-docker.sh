#!/usr/bin/env bash
# Check (or regenerate) the goldens in examples/out with CI's fonts, in Docker (scripts/golden-docker/Dockerfile).
#
#   scripts/golden-docker.sh            pnpm golden: the drift check CI runs (fails when a golden differs from the rebuild)
#   scripts/golden-docker.sh --write    also regenerates every golden the check reports, into examples/out, and checks again
#
# Text widths come from the font files, so a golden holds only for CI's fonts (the pinned Noto Sans JP, see the Dockerfile); a machine
# with other fonts reports drift for figures that are fine on CI. Run this when CI's golden job fails, or after a change to lib/.
# The container's node_modules and pnpm store live in .cache/golden-docker (the host's node_modules may be for another OS).
# --write does not delete files: a stale reveal frame (drift-orphan-reveal) stays reported until you remove it with git rm.
# DOCKER overrides the docker command (e.g. DOCKER="sudo docker").
set -euo pipefail
cd "$(dirname "$0")/.."
write=0
case "$#:${1:-}" in
  0:) ;;
  1:--write) write=1 ;;
  *) echo "usage: scripts/golden-docker.sh [--write]" >&2; exit 2 ;;
esac
image=svg-diagram-golden:noble
docker=${DOCKER:-docker}
$docker build -q -t "$image" scripts/golden-docker >/dev/null
mkdir -p .cache/golden-docker/node_modules .cache/golden-docker/store .cache/golden-docker/home
# the mount point for the container's node_modules: made here (by you), or dockerd makes it owned by root and a later pnpm install fails
mkdir -p node_modules
run() {
  $docker run --rm --user "$(id -u):$(id -g)" -e HOME=/work/.cache/golden-docker/home -e CI=1 \
    -v "$PWD:/work" -v "$PWD/.cache/golden-docker/node_modules:/work/node_modules" "$image" bash -c "set -euo pipefail; $1"
}
setup='pnpm install --frozen-lockfile --store-dir /work/.cache/golden-docker/store --config.confirmModulesPurge=false >/dev/null'
if [[ $write == 0 ]]; then
  run "$setup; pnpm -s golden --no-cache"
  exit
fi
# the check (exit 1 = drift, anything else = it did not run), a build of each source it reported (✗ examples/x.ts: ...), and the check again
run "$setup
  log=.cache/golden-docker/golden.log; rm -f \$log
  st=0; pnpm -s golden --no-cache > \$log 2>&1 || st=\$?
  if [ \$st = 0 ]; then echo 'goldens are up to date'; exit 0; fi
  if [ \$st != 1 ]; then cat \$log; echo \"the check failed (exit \$st)\" >&2; exit \$st; fi
  srcs=\$(grep -o '^✗ examples/[^:]*\.ts' \$log | cut -c5- | sort -u || true)
  if [ -z \"\$srcs\" ]; then cat \$log; echo 'the check failed without naming a source' >&2; exit 1; fi
  echo 'regenerating:'; echo \"\$srcs\"
  node build-diagram.ts \$srcs --out-dir examples/out || echo '(build reported findings; the SVGs are written)'
  pnpm -s golden --no-cache > \$log 2>&1 || { grep -a '^✗' \$log; echo 'still drifting after the rebuild' >&2; exit 1; }
  echo 'goldens rebuilt; the check passes'"
