#!/bin/bash
# ADR 0073 Q3 spike: wall time of the benchmark tree (timing.ts) with and without the row search, alternating, best of N.
# usage: ROOT=<spike worktree> lo-bench.sh <nodes> <plain|and|canvas> <N> '<LO json>'      prints: base/lo min wall ms, min cpu ms, and the figure's crossings / bends
D="$(cd "$(dirname "$0")" && pwd)"; : "${ROOT:?}"; n=$1; mode=$2; N=$3; J=$4
for i in $(seq "$N"); do
  for s in base lo; do
    if [ $s = lo ]; then export LO="$J"; else unset LO; fi
    node "$D/timing.ts" "$ROOT" "$n" "$mode" 2>/dev/null | awk -v s=$s '{print s, $5, $9, $11, $13}'   # cpu, ms, cross, bends
  done
done | awk '{c=$2; m=$3; if(!($1 in mc)||c<mc[$1])mc[$1]=c; if(!($1 in mm)||m<mm[$1])mm[$1]=m; x[$1]=$4; b[$1]=$5} END{for(k in mm)printf "%s min-wall %d min-cpu %d cross %s bends %s\n",k,mm[k],mc[k],x[k],b[k]}' | sort
