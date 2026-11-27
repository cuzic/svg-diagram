import {at} from './finding-rules.ts';
import {MAX_LANES_TO_ORDER, bestLaneOrder, laneDistance} from './lane-order.ts';
import {must} from './must.ts';
import {qualify, scopeOf} from './scope-name.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {SwimlaneTimedBand} from './types/sequence-table-swimlane.ts';
import type {Finding} from './types/verdicts.ts';

export function swimlaneFindings(sl: SwimlaneTimedBand, connects: readonly Pick<LaidOutConnect, 'fromId' | 'toId'>[]): Finding[] {
  const out: Finding[] = [];
  const n = sl.lanes.length;
  if (n > 6) out.push({...at(sl), rule: 'swimlane-lanes', severity: 'warn', message: `レーンが ${n} 本ある（6 本までが目安）`});
  const ids = new Map<string, number>(sl.steps.filter(s => s.id).map((s): [string, number] => [qualify(scopeOf(sl), s.id as string), sl.lanes.findIndex(l => l.id === s.lane)]));
  const flows = connects.filter(c => ids.has(c.fromId) && ids.has(c.toId));
  if (!flows.length) return out;
  const pairs = flows.map((c): [number, number] => [ids.get(c.fromId) as number, ids.get(c.toId) as number]);
  const cur = [...Array(n).keys()];
  const curD = laneDistance(cur, pairs);
  const handOffs = flows.filter(c => ids.get(c.fromId) !== ids.get(c.toId)).length;
  out.push({...at(sl), rule: 'swimlane-hand-offs', severity: 'info', message: `引き継ぎ ${handOffs} 件 / 矢印 ${flows.length} 本。レーン間の距離の合計 ${curD}`});
  if (n >= 2 && n <= MAX_LANES_TO_ORDER) {
    // lanes marked {fixed: true} keep their place (e.g. a collecting 'PM' lane at the bottom)
    const best = bestLaneOrder(n, new Set(cur.filter(i => must(sl.lanes[i]).fixed)), pairs);
    const bestD = laneDistance(best, pairs);
    if (bestD < curD) out.push({...at(sl), rule: 'swimlane-lane-order', severity: 'warn', message: `レーンを「${best.map(i => must(sl.lanes[i]).label.replace(/\n/g, '')).join(' → ')}」の順にすると、レーン間の距離が ${curD} → ${bestD} に減る`});
  }
  return out;
}

export const swimlaneRules = /* @__PURE__ */ Object.freeze({
  'swimlane-lane-order': {doc: 'レーンの並べ替えで、レーンをまたぐ距離を減らせる（swimlane の opts に laneOrder: \'auto\' を渡すと、この順に自動で並べる）', scope: 'band'},
  'swimlane-lanes': {doc: 'レーンが多い（6 本まで）', scope: 'band'},
  'swimlane-hand-offs': {doc: 'レーンをまたぐ引き継ぎの数（情報）', scope: 'band'},
  'one-story': {doc: '1 つの図に、スイムレーンが複数ある（1 図 1 話）', scope: 'diagram'},
  'bpmn-deprecated': {doc: '`bpmn()` は非推奨。`swimlane()` に `kind` と `cols: \'auto\'` を書く（ADR 0086）', scope: 'band'},
} as const);
