import { PALETTE, colorOf, toneStyle } from './tokens.js';
import { snap4, emojiSpan, arrowPath } from './emit-common.js';
import { renderBoxRect } from './emit-box-frame.js';
export function renderCloud(b, day, tones) {
    const out = [];
    const stroke = b.dim ? PALETTE.muted : PALETTE.text, conflict = b.dim ? PALETTE.muted : colorOf('danger', day), accent = b.dim ? PALETTE.muted : colorOf('accent', day);
    for (const e of b.edges)
        out.push(e.arrow === 'dd' ? arrowPath(e.points, conflict, undefined, 2.5, 'both') : arrowPath(e.points, stroke, undefined));
    for (const n of b.nodes)
        out.push(renderBoxRect({ ...n, dim: b.dim }, day, tones, 'plain'));
    const ink = (t) => {
        if (b.dim)
            return PALETTE.muted;
        if (t.tone)
            return t.tone === 'danger' ? conflict : accent;
        const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
        return n ? colorOf(toneStyle(tones, n.tone).text, day) : PALETTE.text;
    };
    for (const t of b.texts)
        out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="${t.anchor ?? 'middle'}" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
    for (const c of b.chips) {
        out.push(`<rect x="${snap4(c.x)}" y="${snap4(c.y)}" width="${snap4(c.w)}" height="${c.h}" fill="${PALETTE.bg}"/>`);
        out.push(`<text x="${Math.round(c.tx)}" y="${Math.round(c.ty)}" text-anchor="middle" font-size="${c.size}" fill="${c.arrow === 'dd' || c.conflict ? conflict : stroke}">${emojiSpan(c.text)}</text>`);
    }
    return out.join('\n  ');
}
