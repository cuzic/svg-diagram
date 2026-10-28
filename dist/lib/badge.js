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
/** Where the middle of a glyph's ink sits above its baseline, in em. Measured on the sans stack's fonts for digits, capitals, kana and
 *  kanji (0.38 on Yu Gothic, 0.36-0.37 on Noto Sans JP): the label is centred by its ink, not by the font's line box. */
export const INK_MID = 0.38;
const APEX = 3; // a triangle's apex rises this far above the circle of the same r
/** Width/height of a badge for a label of measured width `textW`; `r` is the base radius. */
export function badgeBox(cx, cy, textW, r = BADGE_R, shape = 'circle') {
    const reach = shape === 'triangle' ? r + APEX : r;
    const w = Math.max(2 * reach, textW + 2 * BADGE_PAD);
    return { x: cx - w / 2, y: cy - r - (shape === 'triangle' ? APEX : 0), w, h: 2 * r + (shape === 'triangle' ? APEX : 0) };
}
/** Label colour for a fill (resolved #rrggbb): white-ish `bg` or `text`, whichever contrasts more. */
export function badgeTextKey(fillHex) {
    return wcagRatio(PALETTE.bg, fillHex) >= wcagRatio(PALETTE.text, fillHex) ? 'bg' : 'text';
}
export function badgeSvg(o) {
    const { r, w, snap } = o;
    const st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : '';
    // The centre is decided ONCE, from the shape as it is drawn, and the label uses the same point: the shape snaps to the grid and
    // the text used to be rounded on its own, so they disagreed by up to 2px.
    let shape, cx, cy;
    if (o.shape === 'triangle') {
        const hw = w / 2, p = (x, y) => `${Math.round(x)},${Math.round(y)}`;
        cx = Math.round(o.cx);
        const top = Math.round(o.cy) - r - APEX, bottom = Math.round(o.cy) + r;
        // the label goes at the centre of the triangle's inscribed circle (where the most room is), not at its bounding box's middle
        const side = Math.hypot(hw, bottom - top), inradius = (w * (bottom - top) / 2) / ((w + 2 * side) / 2);
        cy = bottom - inradius;
        shape = `<path d="M${p(cx, top)} L${p(cx + hw, bottom)} L${p(cx - hw, bottom)} Z" fill="${o.fill}"${st} stroke-linejoin="round"/>`;
    }
    else if (o.shape === 'square' || w > 2 * r) { // a square, or a wide label: the circle becomes a pill
        const x0 = snap(o.cx - w / 2), x1 = snap(o.cx + w / 2), y0 = snap(o.cy - r), y1 = snap(o.cy + r);
        cx = (x0 + x1) / 2;
        cy = (y0 + y1) / 2;
        shape = `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${o.shape === 'square' ? 3 : r}" fill="${o.fill}"${st}/>`;
    }
    else {
        cx = snap(o.cx);
        cy = snap(o.cy);
        shape = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill}"${st}/>`;
    }
    const base = o.baseline ?? cy + o.size * INK_MID;
    const fill = o.text ?? PALETTE[badgeTextKey(o.fill)];
    const text = o.label === '' ? '' : `\n  <text x="${cx}" y="${Math.round(base)}" text-anchor="middle" font-size="${o.size}" font-weight="${o.weight ?? 700}" fill="${fill}">${o.esc(o.label)}</text>`;
    return `<g role="img" aria-label="${o.esc(o.aria).replace(/"/g, '&quot;')}" data-badge="">\n  ${shape}${text}\n  </g>`;
}
export function pillSvg(o) {
    const st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}` : '';
    return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.h / 2}" fill="${o.fill}"${st}/>\n  <text x="${Math.round(o.cx)}" y="${Math.round(o.baseline + (o.rawY === undefined ? 0 : o.y - o.rawY))}" text-anchor="middle" font-size="${o.size}"${(o.weight ?? 700) === 400 ? '' : ` font-weight="${o.weight ?? 700}"`} fill="${o.text}">${o.labelHtml}</text>`;
}
