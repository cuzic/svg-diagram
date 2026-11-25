import { anchoredSpotlightTarget } from './emit-spotlight.js';
import { PALETTE, colorOf, toneStyle } from './tokens.js';
import { visibleAt } from './reveal-visibility.js';
import { MARK_STROKE, plateStyle } from './image.js';
import { snap4, escapeAttr, emojiSpan } from './emit-common.js';
export function renderImage(b, day, tones, stage) {
    const col = (k) => colorOf(k, day);
    const out = [];
    const esc = escapeAttr;
    const r4 = (r) => ({ x: snap4(r.x), y: snap4(r.y), w: snap4(r.x + r.w) - snap4(r.x), h: snap4(r.y + r.h) - snap4(r.y) });
    const pic = r4(b);
    out.push(`<image x="${pic.x}" y="${pic.y}" width="${pic.w}" height="${pic.h}" href="${b.href}" preserveAspectRatio="none"${b.alt ? ` role="img" aria-label="${esc(b.alt)}"` : ' aria-hidden="true"'}/>`);
    // spotlight: the picture outside the focused marks is veiled (all of it when nothing in it is focused)
    if (b.dim || b.holes?.length) {
        const hole = (m) => { const r = r4(m); return ` M${r.x},${r.y} h${r.w} v${r.h} h${-r.w} Z`; };
        out.push(`<path d="M${pic.x},${pic.y} h${pic.w} v${pic.h} h${-pic.w} Z${b.dim ? '' : (b.holes ?? []).map(hole).join('')}" fill="${PALETTE.bg}" fill-opacity="0.7" fill-rule="evenodd"/>`);
    }
    const marks = b.marks.filter(m => visibleAt(m, stage));
    for (const mk of marks) {
        const m = { ...mk, ...r4(mk) };
        const ink = m.dim || b.dim ? PALETTE.muted : col(toneStyle(tones, m.tone).ink);
        out.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="none" stroke="${ink}" stroke-width="${MARK_STROKE}"${m.dim || b.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : ''}/>`);
    }
    for (const p of b.plates.filter(p => visibleAt(p, stage))) {
        const st = plateStyle(tones, p.tone), dim = p.dim || b.dim;
        const x = snap4(p.x), y = snap4(p.y), w = snap4(p.x + p.w) - x;
        out.push(`<rect x="${x}" y="${y}" width="${w}" height="${p.h}" rx="${p.h / 2}" fill="${dim ? PALETTE.bg : col(st.fill)}" stroke="${dim ? PALETTE.muted : col(st.stroke)}" stroke-width="2"/>`);
        out.push(`<text x="${Math.round(x + w / 2)}" y="${Math.round(y + p.h / 2 + p.size * 0.36)}" text-anchor="middle" font-size="${p.size}" font-weight="700" fill="${dim ? PALETTE.muted : col(st.text)}">${emojiSpan(p.text)}</text>`);
    }
    return out.join('\n  ');
}
export const imageSpotlight = {
    targets: anchoredSpotlightTarget,
    dim(laid, focus) {
        if (focus.contains(laid)) {
            laid.dim = false;
            return;
        }
        const lit = laid.marks.map(focus.contains);
        laid.marks.forEach((mark, i) => { mark.dim = !lit[i]; });
        laid.plates.forEach(plate => { plate.dim = plate.mark === undefined || !lit[plate.mark]; });
        const holes = laid.marks.filter((_mark, i) => lit[i]).map(({ x, y, w, h }) => ({ x, y, w, h }));
        if (holes.length)
            laid.holes = holes;
        else
            laid.dim = true;
    },
};
