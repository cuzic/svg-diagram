import {oneLine} from './diagram-description.ts';
import {at, fromSources} from './finding-rules.ts';
import {must} from './must.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {sourceOf} from './source-ref.ts';
import type {Rect} from './types/core.ts';
import type {Band} from './types/index.ts';
import type {BoxBand} from './types/text-bands.ts';
import type {Finding, LintTarget} from './types/verdicts.ts';

export function graphFindings(
  d: Pick<LintTarget, 'bands' | 'laidOut' | 'connects'>,
  walk: (bands: Band[]) => readonly Band[],
  itemIdsOf: (band: Band) => readonly string[],
): Finding[] {
  const out: Finding[] = [];
  const connects = (d.connects ?? []).filter(c => !c.loopBack); // the arrow back of a step row is not an edge of a graph
  if (connects.length < 3) return [];
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; for (let up = parent.get(r); up !== undefined && up !== r; up = parent.get(r)) r = up; parent.set(x, r); return r; };
  const add = (x: string) => { if (!parent.has(x)) parent.set(x, x); };
  // a row / column end (sources.col(1)) stands for the boxes inside it
  const placed = (d.laidOut ?? []).flatMap(b => b.type === 'box' ? [b] : b.type === 'row' || b.type === 'grid' ? b.children : []).filter(b => !!b.id);
  const inside = (b: Rect, a: Rect) => Math.min(b.x + b.w, a.x + a.w) - Math.max(b.x, a.x) > 0.5 && Math.min(b.y + b.h, a.y + a.h) - Math.max(b.y, a.y) > 0.5; // even partly, as layout counts it
  const endIds = (id: string, area?: Rect): string[] => [id, ...(area ? placed.flatMap(b => b.id && inside(b, area) ? [b.id] : []) : [])];
  for (const c of connects) {
    if (!c.fromId || !c.toId) continue;
    const ids = [...endIds(c.fromId, c.fromArea), ...endIds(c.toId, c.toArea)];
    for (const id of ids) add(id);
    for (const id of ids) parent.set(find(id), find(must(ids[0])));
  }
  const all = walk(d.bands);
  const boxes = all.filter((b): b is BoxBand => b.type === 'box' && !!b.id && !!b.title);
  const orphans = boxes.filter(b => !parent.has(must(b.id)));
  if (orphans.length) out.push({...at(orphans[0], ...orphans.slice(1)), rule: 'graph-orphan-node', severity: 'warn', message: `どの矢印にもつながっていない箱: ${orphans.map(b => `「${oneLine(b.title)}」(${b.id})`).join('、')}。矢印を足すか、箱を消す（注記なら id を付けない）`});
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) { const r = find(id); groups.set(r, [...(groups.get(r) ?? []), id]); }
  if (groups.size > 1) {
    const components = [...groups.values()];
    // Point at the components outside the largest one; keep the first component on a tie.
    const largest = components.reduce((a, b) => a.length >= b.length ? a : b);
    const disconnected = new Set(components.filter(g => g !== largest).flat());
    const refs = all.filter(b => ('id' in b && b.id && disconnected.has(b.id))
      || itemIdsOf(b).some(id => disconnected.has(qualify(scopeOf(b), id)))).map(b => sourceOf(b));
    out.push({...fromSources(refs), rule: 'graph-disconnected', severity: 'warn', message: `矢印でつないだ図が ${groups.size} つのかたまりに分かれている（${components.map(g => g.slice(0, 3).join('・') + (g.length > 3 ? '…' : '')).join(' ／ ')}）。つなぎ忘れがないか、図を分けるか確かめる`});
  }
  return out;
}
