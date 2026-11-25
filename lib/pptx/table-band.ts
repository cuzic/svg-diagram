import type {LaidOutOf} from '../band-table.ts';
import {register} from './adapter.ts';
import type {PptxAdapter, Ctx} from './adapter.ts';
import {PALETTE} from '../tokens.ts';
import {lineXml, presetXml} from './prims.ts';
import {groupXml} from './shapes.ts';
import {freeformPathXml} from './line-shapes.ts';
import {tableXml} from './table.ts';

export const tablePptx: PptxAdapter<LaidOutOf<'table'>> = (band, ctx) => {
  const id = ctx.next();
  register(ctx, band.id, id, band);
  return tableXml(id, band, ctx.ld, ctx.tones, ctx.fonts) + rowCurveXml(band, ctx);
};

/** A journey map's emotion curve over its table, as the svg draws it: the neutral line dashed, the curve, a hollow dot at each point. */
function rowCurveXml(band: LaidOutOf<'table'>, ctx: Ctx): string {
  const c = band.rowCurve;
  if (!c?.points.length) return '';
  const accent = PALETTE[ctx.ld.day].accent, out: string[] = [];
  out.push(lineXml(ctx.next(), 'emotion-neutral', {x: (band.colX[1] ?? band.x) + 8, y: c.midY}, {x: band.x + band.w - 8, y: c.midY}, PALETTE.muted, 1.5, {dashed: true}));
  if (c.points.length > 1) { const id = ctx.next(); out.push(freeformPathXml(id, 'emotion-curve', c.points.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]})), accent, 2.5)); }
  for (const p of c.points) out.push(presetXml(ctx.next(), 'emotion', 'ellipse', {x: p.x - 4, y: p.y - 4, w: 8, h: 8}, {fill: PALETTE.bg, stroke: accent, widthPx: 2.5}));
  return groupXml(ctx.next(), 'emotion-curve', {x: band.x, y: c.top, w: band.w, h: c.bottom - c.top}, out.join(''));
}
