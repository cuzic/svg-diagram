#!/usr/bin/env bash
# Tag a release whose commit carries the compiled dist/, so that
#   pnpm add -D github:cuzic/svg-diagram#vX.Y.Z
# works without any build step on the consumer side.
# Usage: scripts/release.sh   (version is taken from package.json; nothing is pushed)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean" >&2; exit 1; }
V="v$(node -p "require('./package.json').version")"
rm -rf dist && node_modules/.bin/tsc -p tsconfig.build.json
git add -f dist
git commit -q -m "release $V (with dist/)"
git tag "$V"
echo "tagged $V — push with: git push origin $V   (this commit is not on main)"
