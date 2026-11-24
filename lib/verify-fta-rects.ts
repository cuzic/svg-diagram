import type {LaidOutFta} from './types/diagrams.ts';
import type {CheckRect} from './types/verdicts.ts';

export function ftaRects(band: LaidOutFta): CheckRect[] {
  return band.nodes.map((n, i) => ({id: n.id ?? null, label: band.labelBoxes[i]?.label ?? 'event', x: n.x, y: n.y, w: n.w, h: n.h, ...(band.id ? {holds: [band.id]} : {})}));
}
