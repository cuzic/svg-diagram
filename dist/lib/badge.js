// Badge: a short label (a number, a letter) drawn inside a shape, as ONE primitive.
//
// Every numbered / lettered mark in the tool (callouts, note numbers, robot markers, route points,
// box({step})) used to be a hand-assembled circle + text, with the workarounds repeated at each site
// (an invisible "container" rect so the lint does not read the number as covered, a fixed radius, a
// hard-coded label colour, a +4 nudge for triangles). Here they live in one place:
//  - the shape grows to fit the label (a 1-char label keeps the base radius, longer ones widen it);
//  - the label colour is picked from the fill so the contrast is >= 4.5:1;
//  - the vertical centring is decided per shape;
//  - the SVG is a <g role="img" aria-label data-badge>: one accessible unit, and the lint treats the
//    group as the label's own container.
import { PALETTE, wcagRatio } from './tokens.js';
export const BADGE_R = 11; // base radius: fits 1-2 digits or one letter at the wireframe's 14px
const BADGE_PAD = 6; // room each side of a label wider than the base shape
/** Width/height of a badge for a label of measured width `textW`; `r` is the base radius. */
export function badgeBox(cx, cy, textW, r = BADGE_R, shape = 'circle') {
    const reach = shape === 'triangle' ? r + 3 : r;
    const w = Math.max(2 * reach, textW + 2 * BADGE_PAD);
    return { x: cx - w / 2, y: cy - r - (shape === 'triangle' ? 3 : 0), w, h: 2 * r + (shape === 'triangle' ? 3 : 0) };
}
/** Label colour for a fill (resolved #rrggbb): white-ish `bg` or `text`, whichever contrasts more. */
export function badgeTextKey(fillHex) {
    return wcagRatio(PALETTE.bg, fillHex) >= wcagRatio(PALETTE.text, fillHex) ? 'bg' : 'text';
}
export function badgeSvg(o) {
    const { cx, cy, r, w, snap } = o;
    const st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : '';
    let shape;
    if (o.shape === 'square') {
        shape = `<rect x="${snap(cx - w / 2)}" y="${snap(cy - r)}" width="${snap(cx + w / 2) - snap(cx - w / 2)}" height="${snap(cy + r) - snap(cy - r)}" rx="3" fill="${o.fill}"${st}/>`;
    }
    else if (o.shape === 'triangle') {
        const hw = w / 2, p = (x, y) => `${Math.round(x)},${Math.round(y)}`;
        shape = `<path d="M${p(cx, cy - r - 3)} L${p(cx + hw, cy + r)} L${p(cx - hw, cy + r)} Z" fill="${o.fill}"${st} stroke-linejoin="round"/>`;
    }
    else if (w > 2 * r) { // a wide label: the circle becomes a pill
        shape = `<rect x="${snap(cx - w / 2)}" y="${snap(cy - r)}" width="${snap(cx + w / 2) - snap(cx - w / 2)}" height="${snap(cy + r) - snap(cy - r)}" rx="${r}" fill="${o.fill}"${st}/>`;
    }
    else {
        shape = `<circle cx="${snap(cx)}" cy="${snap(cy)}" r="${r}" fill="${o.fill}"${st}/>`;
    }
    const base = o.baseline ?? cy + o.size * 0.36 + (o.shape === 'triangle' ? 4 : 0);
    const fill = o.text ?? PALETTE[badgeTextKey(o.fill)];
    const text = o.label === '' ? '' : `\n  <text x="${Math.round(cx)}" y="${Math.round(base)}" text-anchor="middle" font-size="${o.size}" font-weight="${o.weight ?? 700}" fill="${fill}">${o.esc(o.label)}</text>`;
    return `<g role="img" aria-label="${o.esc(o.aria).replace(/"/g, '&quot;')}" data-badge="">\n  ${shape}${text}\n  </g>`;
}
export function pillSvg(o) {
    const st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : '';
    return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.h / 2}" fill="${o.fill}"${st}/>\n  <text x="${Math.round(o.cx)}" y="${Math.round(o.baseline)}" text-anchor="middle" font-size="${o.size}"${(o.weight ?? 700) === 400 ? '' : ` font-weight="${o.weight ?? 700}"`} fill="${o.text}">${o.labelHtml}</text>`;
}
