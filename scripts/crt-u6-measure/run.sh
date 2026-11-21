#!/bin/bash
# ADR 0070 U6 measurement. Needs a scratch worktree of main with probe.patch applied (`git apply scripts/crt-u6-measure/probe.patch`): the toggles live in lib/u6-probe.ts (env U6, JSON),
# so lib/ on main is untouched. Usage: ROOT=<scratch worktree> ./run.sh <tag> '<json toggles>' ; then node compare.mjs <tagA> <tagB>
# Toggles: noShift noTurn noApart (D12-D14) | pairs/sPairs: mid|last (run pairs in better() / the order search) | height: off|soft|key|xdrop (+cap) | axis: off|rank
# patience patienceQuiet maxOrders patLaid noProxy noSearch | andAlign: both|tail | gapTracks crowdTracks | epAll (edge-parallel on every origin) | proxyScan
: "${ROOT:?set ROOT to the scratch worktree}"
D="$(cd "$(dirname "$0")" && pwd)"; mkdir -p res
U6="${2:-{\}}" node "$D/random-crt.ts" "$ROOT" 150 > res/$1-p.json 2> res/$1-p.err &
U6="${2:-{\}}" node "$D/random-crt.ts" "$ROOT" 80 canvas > res/$1-c.json 2> res/$1-c.err &
wait
