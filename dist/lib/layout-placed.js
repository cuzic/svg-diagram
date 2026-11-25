import { scopeOf } from './scope-name.js';
export const rectOf = (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h });
/** Writes `scope` onto a laid-out band/step whose static type has no such field (ADR 0012: scope is bolted on after layout, not part of each band's own shape). */
export const setScope = (placed, scope) => { if (scope)
    placed.scope = scope; };
const say = (s, band) => typeof s === 'string' ? s : s(band);
export function placedBand(layout, what, anchorWhat) {
    return (band, ctx, padX, cw) => {
        const placed = layout(band, padX, ctx.originOf(band, ctx.y), cw, ctx); // placed on the grid; the cursor stays where it was (no drift)
        appendPlacedBand(band, placed, ctx, say(what, band), anchorWhat === undefined ? undefined : say(anchorWhat, band));
    };
}
export function appendPlacedBand(band, placed, ctx, what, anchorWhat) {
    const scope = scopeOf(band); // ADR 0012: the band's items are registered as `scope.id`; the band's own output keeps its bare ids, and says which scope they belong to
    setScope(placed, scope);
    if (band.id)
        ctx.register(band.id, rectOf(placed), what);
    const unanchored = band.unanchored; // whyWhyTree(): entities the maker named itself are not names the author can use
    if (anchorWhat !== undefined)
        for (const a of placed.anchors)
            if (!unanchored?.includes(a.id))
                ctx.register(a.id, rectOf(a), anchorWhat, scope);
    ctx.laidOut.push(placed);
    ctx.y += placed.h + ctx.d.gap;
}
