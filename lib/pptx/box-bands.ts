import type {LaidOutOf} from '../band-table.ts';
import {PALETTE} from '../tokens.ts';
import {ringed, stepBadgeAt} from '../emit-boxes.ts';
import {visibleAt} from '../reveal-visibility.ts';
import {must} from '../must.ts';
import {badgeTextKey} from '../badge.ts';
import {fitConnector, siteIndex} from './geom.ts';
import {boxTextXml, geomShapeXml, linesText, namedAs, roundGeomXml} from './prims.ts';
import {boxXml, plainBox, groupFrameXml, groupXml} from './shapes.ts';
import type {TextBox} from './shapes.ts';
import {rowArrowXml} from './connectors.ts';
import type {Glue} from './connectors.ts';
import {register} from './adapter.ts';
import type {BandXml, Ctx} from './adapter.ts';
import type {Rect} from './xml.ts';

/** A box or banner, with the parts a box may carry beside its frame. */
type BoxLike = TextBox & Pick<LaidOutOf<'box'>, 'id' | 'tag' | 'tagBox' | 'stamp' | 'stampW' | 'step' | 'icon'>;

/** A box's text, its lines joined: what it is named by (ADR 0054 D7). */
const textOf = (b: TextBox): string => linesText((b.wrappedRuns ?? []).flatMap(r => r.lines));

/** Font size of the small badges (tag, stamp, step) a box carries beside its main shape. */
const badgeSize = (r: Rect): number => Math.min(12, Math.max(8, r.h * 0.48));

export const boxPptx = (b: BoxLike, ctx: Ctx): string => {
  const id = ctx.next();
  register(ctx, b.id, id, b);
  const text = textOf(b), main = boxXml(id, namedAs('box', text, b.id), b, ctx.ld.day, ctx.tones, ctx.fonts);
  if (!b.tag && !b.stamp && b.step === undefined && !b.icon) return main;
  const badge = (text: string, r: Rect, name: string): string =>
    boxXml(ctx.next(), name, plainBox(r, text, {size: badgeSize(r), weight: 700, tone: b.tone, frame: true, padX: 2, padY: 1}), ctx.ld.day, ctx.tones, ctx.fonts);
  const extra: string[] = [];
  if (b.tag && b.tagBox) extra.push(badge(b.tag, b.tagBox, namedAs('tag', b.tag)));
  if (b.stamp) extra.push(badge(b.stamp, {x: b.x + b.w - (b.stampW ?? 64) - 8, y: b.y + b.h - 22, w: b.stampW ?? 64, h: 18}, namedAs('stamp', b.stamp)));
  // the icon glyph is not drawn yet (ADR 0027 follow-up): an empty frame in its place would read as a real shape
  if (b.step !== undefined && 'wrappedRuns' in b) {
    // as the svg draws it (emit-boxes.ts stepBadgeAt): a circle in the accent with the number in white on the title's baseline
    const g = stepBadgeAt(b, ctx.ld.roles), r = {x: g.cx - g.r, y: g.cy - g.r, w: 2 * g.r, h: 2 * g.r}, fill = PALETTE[ctx.ld.day].accent;
    const line = {text: String(b.step), x: g.cx, y: g.baseline, anchor: 'middle' as const, size: g.size, bold: true, color: PALETTE[badgeTextKey(fill)]};
    extra.push(geomShapeXml(ctx.next(), namedAs('step', String(b.step)), r, roundGeomXml('ellipse', r.w, r.h), {fill, ...(ringed(b) ? {stroke: PALETTE.bg, widthPx: 2} : {})}, boxTextXml(r, [line], ctx.fonts)));
  } else if (b.step !== undefined) extra.push(badge(String(b.step), {x: b.x + 8 + (b.icon ? 34 : 0), y: b.y + 8, w: 24, h: 24}, namedAs('step', String(b.step))));
  const minY = Math.min(b.y, b.tagBox?.y ?? b.y), maxY = Math.max(b.y + b.h, (b.tagBox?.y ?? b.y) + (b.tagBox?.h ?? 0));
  return groupXml(ctx.next(), namedAs('node', text, b.id), {x: b.x, y: minY, w: b.w, h: maxY - minY}, main + extra.join(''));
};

export {captionPptx} from './caption-band.ts';

const verticalExtent = (children: Rect[]): {y: number; h: number} => {
  const y = Math.min(...children.map(c => c.y));
  return {y, h: Math.max(...children.map(c => c.y + c.h)) - y};
};

export const rowPptx: BandXml<LaidOutOf<'row'>> = (band, ctx) => {
  const gid = ctx.next();
  const inner = band.children.filter(c => visibleAt(c, ctx.stage)).map(c => boxPptx(c, ctx)).join('');
  const group = groupXml(gid, namedAs('row', '', band.id), band, inner);
  const nearest = (x: number, y: number) => band.children.map(c => ({c, d: Math.min(Math.abs(x - c.x), Math.abs(x - c.x - c.w), Math.abs(y - c.y), Math.abs(y - c.y - c.h))})).sort((u, v) => u.d - v.d)[0];
  const rowGlue = (x: number, y: number): Glue | undefined => {
    const n = nearest(x, y), shape = n?.c.id ? ctx.glue.get(n.c.id) : undefined;
    return n && shape && n.d <= 2 ? {id: shape.id, idx: siteIndex(n.c, {x, y}, '')} : undefined;
  };
  const arrows = band.arrows.flatMap((a, i) => {
    if (ctx.stage !== undefined && (!visibleAt(must(band.children[i]), ctx.stage) || !visibleAt(must(band.children[i + 1]), ctx.stage))) return [];
    const fit = fitConnector([{x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}]);
    return fit.ok ? [rowArrowXml(ctx.next(), `row-arrow-${i}`, fit.x, rowGlue(a.x1, a.y1), rowGlue(a.x2, a.y2))] : [];
  });
  return group + arrows.join('');
};

export const gridPptx: BandXml<LaidOutOf<'grid'>> = (band, ctx) => {
  const gid = ctx.next();
  const inner = band.children.filter(c => visibleAt(c, ctx.stage)).map(c => boxPptx(c, ctx)).join('');
  return groupXml(gid, 'grid', {...verticalExtent(band.children), x: band.x, w: band.w}, inner);
};

export const groupPptx: BandXml<LaidOutOf<'group'>> = (band, ctx) => {
  const id = ctx.next();
  register(ctx, band.id, id, band);
  return groupFrameXml(id, namedAs('frame', '', band.id), band, band.tone, band.dashed, ctx.ld.day, ctx.tones);
};

export const bannerPptx = boxPptx;
