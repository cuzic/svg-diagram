#!/bin/bash
# usage (in the directory that holds res/): lo-run.sh <tag> <root>   (300 plain + 150 canvas figures in parallel, ~35 s). <root> = a worktree of main for the base, of the branch for the other.
D="$(cd "$(dirname "$0")" && pwd)"; mkdir -p res
node "$D/pins-measure.ts" "$2" 300 > res/$1-p.json 2> res/$1-p.err &
node "$D/pins-measure.ts" "$2" 150 canvas > res/$1-c.json 2> res/$1-c.err &
wait
