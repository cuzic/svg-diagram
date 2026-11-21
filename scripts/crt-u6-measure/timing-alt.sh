#!/bin/bash
# Cost check for ADR 0073: alternate two toggle settings on the same tree, N times each, and print the minimum (best of N) and the spread of each.
# Usage: ROOT=<scratch worktree with probe.patch> ./timing-alt.sh <nodes> <plain|and|canvas> <N> '<json A>' '<json B>'   (A = main: '{}')
# Alternating (A, B, A, B, ...) keeps a load change on the machine from favouring one side. The criterion in ADR 0073: min(B) <= 1.05 * min(A).
: "${ROOT:?set ROOT to the scratch worktree}"
D="$(cd "$(dirname "$0")" && pwd)"; n=$1; mode=$2; N=$3; A=$4; B=$5
for i in $(seq "$N"); do
  for s in A B; do j=$A; [ $s = B ] && j=$B
    ms=$(U6="$j" node "$D/timing.ts" "$ROOT" "$n" "$mode" | sed -n 's/.* ms \([0-9]*\) .*/\1/p'); echo "$s $ms"
  done
done | awk '{v[$1]=v[$1]" "$2; if(!($1 in m)||$2<m[$1])m[$1]=$2; if($2>x[$1])x[$1]=$2} END{for(k in m)printf "%s min %d max %d  all:%s\n",k,m[k],x[k],v[k]}' | sort
