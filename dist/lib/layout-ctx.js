import { withSource } from './source-ref.js';
import { must } from './must.js';
/** What laying bands out writes into the layout context, copied so that a layout can be taken back (ADR 0049; layoutGroupRow does the same). A new piece of state in LayoutCtx belongs here. */
export function snapshotCtx(ctx) {
    return { n: ctx.laidOut.length, y: ctx.y, seen: ctx.lines.seen, anchors: new Map(ctx.anchors), nodeBottoms: new Map(ctx.nodeBottoms), areaIds: new Set(ctx.areaIds), connects: ctx.connects.length, deferred: ctx.deferred.length, scopes: new Map([...ctx.scopes.byBare].map(([k, v]) => [k, [...v]])) };
}
export function restoreCtx(ctx, s) {
    ctx.laidOut.length = s.n;
    ctx.y = s.y;
    ctx.lines.seen = s.seen;
    ctx.anchors.clear();
    for (const [k, v] of s.anchors)
        ctx.anchors.set(k, v);
    ctx.nodeBottoms.clear();
    for (const [k, v] of s.nodeBottoms)
        ctx.nodeBottoms.set(k, v);
    ctx.areaIds.clear();
    for (const k of s.areaIds)
        ctx.areaIds.add(k);
    ctx.connects.length = s.connects;
    ctx.deferred.length = s.deferred;
    ctx.scopes.byBare.clear();
    for (const [k, v] of s.scopes)
        ctx.scopes.byBare.set(k, v);
}
/** Propagate a band's source to its output without replacing more specific child sources. */
export function markPlacedSource(laidOut, start, source) {
    if (!source)
        return;
    for (let i = start; i < laidOut.length; i++) {
        const placed = must(laidOut[i]);
        withSource(placed, source);
        if ('children' in placed)
            for (const child of placed.children)
                withSource(child, source);
    }
}
