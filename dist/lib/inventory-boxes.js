import { frameGeometry, stampGeometry, tagGeometry } from './emit-box-frame.js';
import { boxTextPlacement } from './emit-box-text.js';
import { captionTextPlacement } from './emit-caption.js';
import { runLineOrigin } from './emit-common.js';
import { pathItems } from './inventory-lines.js';
import { lineWidth } from './layout-text.js';
import { must } from './must.js';
export const INK_ASCENT = 1.0;
export const INK_HEIGHT = 1.3;
const INK_SIDE_PAD = 0.125;
export const captionItems = (band, ctx) => wrappedText(band.wrappedRuns, captionTextPlacement(band), ctx);
export const groupItems = (band, { owner }) => boxChrome(band, owner);
function wrappedText(runs, placement, { owner, widthOf }) {
    return runs.flatMap(run => {
        const { lx, anchor } = runLineOrigin(run, placement), { size } = run;
        return run.lines.map((_, i) => {
            const w = lineWidth(widthOf, run, i);
            const x = anchor === 'middle' ? lx - w / 2 : anchor === 'end' ? lx - w : lx;
            const y = placement.originY + must(run.lineYs[i]) - INK_ASCENT * size;
            const pad = INK_SIDE_PAD * size;
            return { kind: 'text', owner, rect: { x: x - pad, y, w: w + 2 * pad, h: INK_HEIGHT * size }, size };
        });
    });
}
function boxChrome(band, owner) {
    const items = [];
    if (band.type === 'banner' || band.frame !== false) {
        const { x, y, w, h } = frameGeometry(band);
        items.push({ kind: 'frame', owner, poly: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    }
    if (band.type === 'box' && band.tagBox)
        items.push({ kind: 'badge', owner, what: 'tag', rect: tagGeometry(band.tagBox) });
    if (band.stampW !== undefined)
        items.push({ kind: 'badge', owner, what: 'stamp', rect: stampGeometry(band, band.stampW) });
    return items;
}
export function boxItems(band, ctx) {
    return [...boxChrome(band, ctx.owner), ...wrappedText(band.wrappedRuns, boxTextPlacement(band), ctx)];
}
export function childBoxes({ children }, { owner, widthOf }) {
    return children.flatMap((child, i) => boxItems(child, { owner: child.id ?? `${owner}/${i}`, widthOf }));
}
export function rowItems(band, ctx) {
    return [
        ...childBoxes(band, ctx),
        ...band.arrows.flatMap(({ x1, y1, x2, y2 }, i) => pathItems([{ x: x1, y: y1 }, { x: x2, y: y2 }], 'end', `${ctx.owner}>${i}`)),
    ];
}
