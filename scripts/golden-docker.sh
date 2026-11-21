#!/usr/bin/env bash
# Check (or regenerate) the goldens in examples/out with CI's fonts, in Docker (scripts/golden-docker/Dockerfile).
#
#   scripts/golden-docker.sh            pnpm golden: the drift check CI runs (fails when a golden differs from the rebuild)
#   scripts/golden-docker.sh --write    also regenerates every golden the check reports, into examples/out
#
# A golden holds only for CI's fonts (text widths come from the font files), so a laptop with other fonts reports drift
# for figures that are fine on CI. Run this instead of `pnpm golden` when CI's golden job fails, or after a change to lib/.
# The container's node_modules and pnpm store live in .cache/golden-docker (the host's node_modules may be for another OS).
# DOCKER overrides the docker command (e.g. DOCKER="sudo docker").
set -euo pipefail
cd "$(dirname "$0")/.."
write=0
if [[ "${1:-}" == "--write" ]]; then write=1; shift; fi
image=svg-diagram-golden:noble
docker=${DOCKER:-docker}
$docker build -q -t "$image" scripts/golden-docker >/dev/null
mkdir -p .cache/golden-docker/node_modules .cache/golden-docker/store .cache/golden-docker/home
run() {
  $docker run --rm --user "$(id -u):$(id -g)" -e HOME=/work/.cache/golden-docker/home -e CI=1 \
    -v "$PWD:/work" -v "$PWD/.cache/golden-docker/node_modules:/work/node_modules" "$image" bash -c "$1"
}
setup='pnpm install --frozen-lockfile --store-dir /work/.cache/golden-docker/store --config.confirmModulesPurge=false >/dev/null'
if [[ $write == 0 ]]; then
  run "$setup && pnpm golden"
  exit
fi
# the check, then a build of each source it reported (✗ examples/x.ts: ...)
run "$setup && { pnpm -s golden > .cache/golden-docker/golden.log 2>&1 || true; }
  srcs=\$(grep -o '^✗ examples/[^:]*\.ts' .cache/golden-docker/golden.log | cut -c5- | sort -u)
  if [ -z \"\$srcs\" ]; then echo 'goldens are up to date'; exit 0; fi
  echo \"regenerating:\"; echo \"\$srcs\"
  node build-diagram.ts \$srcs --out-dir examples/out --no-lint"
