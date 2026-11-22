#!/bin/bash
# usage (in the directory that holds res/): ROOT=<spike worktree> lo-run.sh <tag> '<LO json>'   (300 plain + 150 canvas in parallel, ~35 s). An empty json = the unchanged search (the baseline).
D="$(cd "$(dirname "$0")" && pwd)"; : "${ROOT:?}"; mkdir -p res
if [ -n "$2" ]; then export LO="$2"; else unset LO; fi
node "$D/pins-measure.ts" "$ROOT" 300 > res/$1-p.json 2> res/$1-p.err &
node "$D/pins-measure.ts" "$ROOT" 150 canvas > res/$1-c.json 2> res/$1-c.err &
wait
