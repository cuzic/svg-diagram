import type {LaidOutTree} from './types/diagrams.ts';
import type {CheckRect} from './types/verdicts.ts';

export function treeRects(band: LaidOutTree): CheckRect[] {
  let li = 0;
  return band.nodes.flatMap(n => n.band ? [] : [{id: n.id ?? null, label: band.labelBoxes[li++]?.label ?? 'node', x: n.x, y: n.y, w: n.w, h: n.h, ...(band.id ? {holds: [band.id]} : {})}]);
}
