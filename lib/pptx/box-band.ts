import type {LaidOutOf} from '../band-table.ts';
import {PALETTE} from '../tokens.ts';
import {ringed, stepBadgeAt} from '../emit-box.ts';
import {badgeTextKey} from '../badge.ts';
import {boxTextXml, geomShapeXml, namedAs, roundGeomXml} from './prims.ts';
import {boxXml, groupXml} from './shapes.ts';
import type {TextBox} from './shapes.ts';
import {register} from './adapter.ts';
import type {Ctx} from './adapter.ts';
import {boxBadge, stampBadge, textOf} from './box-decoration.ts';

/** A box or banner, with the parts a box may carry beside its frame. */
type BoxLike = TextBox & Pick<LaidOutOf<'box'>, 'id' | 'tag' | 'tagBox' | 'stamp' | 'stampW' | 'step' | 'icon'>;

export const boxPptx = (b: BoxLike, ctx: Ctx): string => {
  const id = ctx.next();
  register(ctx, b.id, id, b);
  const text = textOf(b), main = boxXml(id, namedAs('box', text, b.id), b, ctx.ld.day, ctx.tones, ctx.fonts);
  if (!b.tag && !b.stamp && b.step === undefined && !b.icon) return main;
  const extra: string[] = [];
  if (b.tag && b.tagBox) extra.push(boxBadge(ctx, b.tone, b.tag, b.tagBox, namedAs('tag', b.tag)));
  if (b.stamp) extra.push(stampBadge(ctx, b, b.stamp));
  // the icon glyph is not drawn yet (ADR 0027 follow-up): an empty frame in its place would read as a real shape
  if (b.step !== undefined && 'wrappedRuns' in b) {
    // as the SVG draws it: a circle in the accent with the number in white on the title's baseline
    const g = stepBadgeAt(b, ctx.ld.roles), r = {x: g.cx - g.r, y: g.cy - g.r, w: 2 * g.r, h: 2 * g.r}, fill = PALETTE[ctx.ld.day].accent;
    const line = {text: String(b.step), x: g.cx, y: g.baseline, anchor: 'middle' as const, size: g.size, bold: true, color: PALETTE[badgeTextKey(fill)]};
    extra.push(geomShapeXml(ctx.next(), namedAs('step', String(b.step)), r, roundGeomXml('ellipse', r.w, r.h), {fill, ...(ringed(b) ? {stroke: PALETTE.bg, widthPx: 2} : {})}, boxTextXml(r, [line], ctx.fonts)));
  } else if (b.step !== undefined) extra.push(boxBadge(ctx, b.tone, String(b.step), {x: b.x + 8 + (b.icon ? 34 : 0), y: b.y + 8, w: 24, h: 24}, namedAs('step', String(b.step))));
  const minY = Math.min(b.y, b.tagBox?.y ?? b.y), maxY = Math.max(b.y + b.h, (b.tagBox?.y ?? b.y) + (b.tagBox?.h ?? 0));
  return groupXml(ctx.next(), namedAs('node', text, b.id), {x: b.x, y: minY, w: b.w, h: maxY - minY}, main + extra.join(''));
};
