import { linesText, namedAs } from './prims.js';
import { boxXml, plainBox } from './shapes.js';
/** A box's text, its lines joined: what it is named by (ADR 0054 D7). */
export const textOf = (b) => linesText((b.wrappedRuns ?? []).flatMap(r => r.lines));
/** Font size of the small badges (tag, stamp, step) a box carries beside its main shape. */
const badgeSize = (r) => Math.min(12, Math.max(8, r.h * 0.48));
export function boxBadge(ctx, tone, text, rect, name) {
    return boxXml(ctx.next(), name, plainBox(rect, text, {
        size: badgeSize(rect), weight: 700, tone, frame: true, padX: 2, padY: 1,
    }), ctx.ld.day, ctx.tones, ctx.fonts);
}
export function stampBadge(ctx, box, stamp) {
    const width = box.stampW ?? 64;
    return boxBadge(ctx, box.tone, stamp, {
        x: box.x + box.w - width - 8, y: box.y + box.h - 22, w: width, h: 18,
    }, namedAs('stamp', stamp));
}
