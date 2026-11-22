#!/bin/bash
# ADR 0075 cost: the benchmark tree (timing.ts) on two worktrees, alternating, best of N. The layouts (the last number of timing.ts) are the load-independent cost; the wall time is for the record.
# usage: lo-bench.sh <rootBase> <rootNew> <nodes> <plain|and|canvas> <N>
D="$(cd "$(dirname "$0")" && pwd)"; n=$3; mode=$4; N=$5
for i in $(seq "$N"); do
  for s in base new; do
    r=$1; [ $s = new ] && r=$2
    node "$D/timing.ts" "$r" "$n" "$mode" 2>/dev/null | awk -v s=$s '{print s, $5, $9, $11, $13, $NF}'   # cpu, ms, cross, bends, layouts
  done
done | awk '{c=$2; m=$3; if(!($1 in mc)||c<mc[$1])mc[$1]=c; if(!($1 in mm)||m<mm[$1])mm[$1]=m; x[$1]=$4; b[$1]=$5; l[$1]=$6} END{for(k in mm)printf "%s min-wall %d min-cpu %d cross %s bends %s layouts %s\n",k,mm[k],mc[k],x[k],b[k],l[k]}' | sort
