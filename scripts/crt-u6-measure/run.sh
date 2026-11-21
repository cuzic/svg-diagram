#!/bin/bash
# ADR 0070 U6 / ADR 0073 measurement.
# Provenance: probe.patch is `git diff 456ef142 -- lib` of the scratch branch (456ef142 = main at PR #402). It applies cleanly to that commit; it will stop applying once
# lib/toc.ts or lib/layered-route.ts changes (ADR 0073 U1 changes them): remake it on the new base, do not merge it. lib/ of the repository is untouched; the toggles live in lib/u6-probe.ts (env U6, JSON).
# Setup:  git worktree add ../scratch 456ef142 && (cd ../scratch && git apply <repo>/scripts/crt-u6-measure/probe.patch && ln -s <repo>/node_modules node_modules)
# Usage:  run it from a scratch directory (it writes res/ into the current directory, never into the repo):
#           ROOT=<scratch worktree> <repo>/scripts/crt-u6-measure/run.sh <tag> '<json toggles>'   # ~40-70 s (150 + 80 figures in parallel)
#           node <repo>/scripts/crt-u6-measure/compare.mjs <tagA> <tagB>   # sums and the figures that went up/down
#           node <repo>/scripts/crt-u6-measure/perfig.mjs <tagA> <tagB>    # per-figure maxima: bends, height, pairs; figures that got worse
#           node <repo>/scripts/crt-u6-measure/pins.mjs <tagMain> <tagNew> > pins.json   # the per-figure values the ADR 0073 tests pin
# The proposal of ADR 0073 (D1 + D2 + D3):  '{"height":"xcross","axis":"rank","pairs":"mid","sPairs":"mid","andAlign":"tail"}'   (main = '{}')
# Toggles: noShift noTurn noApart (D12-D14) | pairs/sPairs: mid|last (run pairs in better() / the order search) | height: off|soft|key|xdrop|xcross (+cap, capBudget) | tieH (height as the last key)
#          axis: off|rank (rankEps: ranks joined by gaps over 0.5px) | patience patienceQuiet maxOrders patLaid noProxy noSearch | andAlign: both|tail (tailSep) | gapTracks crowdTracks | epAll | proxyScan
# xdrop = taller candidates need (AND crossings, AND pairs, crossings) to fall; xcross = ADR 0073 D1: crossings fall strictly and the score is lexicographically better. Same figures in all 218.
# Other scripts: random-crt.ts (the figures), timing.ts + timing-alt.sh (cost, alternating), fixture.ts (the U0 fixture, examples/toc-*), edge-parallel-origins.ts, order-climb.ts, layered-min.ts, proxy-scan.ts.
: "${ROOT:?set ROOT to the scratch worktree}"
D="$(cd "$(dirname "$0")" && pwd)"; mkdir -p res
U6="${2:-{\}}" node "$D/random-crt.ts" "$ROOT" 150 > res/$1-p.json 2> res/$1-p.err &
U6="${2:-{\}}" node "$D/random-crt.ts" "$ROOT" 80 canvas > res/$1-c.json 2> res/$1-c.err &
wait
