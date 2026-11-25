import {scopeOf} from './scope-name.ts';
import type {BandLayoutHandler, LayoutCtx} from './layout-ctx.ts';
import type {Rect} from './types/core.ts';
import type {Band, LaidOutBand} from './types/index.ts';

export const rectOf = (p: Rect): Rect => ({x: p.x, y: p.y, w: p.w, h: p.h});
/** Writes `scope` onto a laid-out band/step whose static type has no such field (ADR 0012: scope is bolted on after layout, not part of each band's own shape). */
export const setScope = (placed: object, scope: string | undefined): void => { if (scope) (placed as unknown as {scope: string}).scope = scope; };

/**
 * A band laid out by one call (`layout`) that returns its own placement: its id (and its marks' ids, when `anchorWhat` is given)
 * become anchors, it is pushed, and the cursor moves past it. `what` / `anchorWhat` finish the duplicate-id message.
 */
type Describe<B> = string | ((band: B) => string);
const say = <B,>(s: Describe<B>, band: B): string => typeof s === 'string' ? s : s(band);
export function placedBand<B extends Band & {id?: string}, P extends LaidOutBand & Rect>(
  layout: (band: B, x: number, y: number, w: number, ctx: LayoutCtx) => P,
  what: Describe<B>,
  anchorWhat?: Describe<B>,
): BandLayoutHandler<B> {
  return (band, ctx, padX, cw) => {
    const placed = layout(band, padX, ctx.originOf(band, ctx.y), cw, ctx); // placed on the grid; the cursor stays where it was (no drift)
    appendPlacedBand(band, placed, ctx, say(what, band), anchorWhat === undefined ? undefined : say(anchorWhat, band));
  };
}

export function appendPlacedBand(band: Band & {id?: string}, placed: LaidOutBand & Rect, ctx: LayoutCtx, what: string, anchorWhat?: string): void {
  const scope = scopeOf(band); // ADR 0012: the band's items are registered as `scope.id`; the band's own output keeps its bare ids, and says which scope they belong to
  setScope(placed, scope);
  if (band.id) ctx.register(band.id, rectOf(placed), what);
  const unanchored = (band as {unanchored?: readonly string[]}).unanchored; // whyWhyTree(): entities the maker named itself are not names the author can use
  if (anchorWhat !== undefined) for (const a of (placed as unknown as {anchors: (Rect & {id: string})[]}).anchors) if (!unanchored?.includes(a.id)) ctx.register(a.id, rectOf(a), anchorWhat, scope);
  ctx.laidOut.push(placed);
  ctx.y += placed.h + ctx.d.gap;
}
