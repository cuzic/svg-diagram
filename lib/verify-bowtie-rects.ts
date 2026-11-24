import type {LaidOutBowtie} from './types/diagrams.ts';
import type {CheckRect} from './types/verdicts.ts';

export function bowtieRects(band: LaidOutBowtie): CheckRect[] {
  return band.nodes.map((n, i) => ({id: null, label: band.labelBoxes[i]?.label ?? 'box', x: n.x, y: n.y, w: n.w, h: n.h, ...(band.id ? {holds: [band.id]} : {})}));
}
