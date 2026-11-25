import { PALETTE, colorOf, toneStyle, isSolidTone } from './tokens.js';
import { snap4, escapeXml, emojiSpan, arrowPath, resolveBoxStyle } from './emit-common.js';
import { HOP_R } from './cause-hop.js';
import { renderBoxRect } from './emit-box-frame.js';
import { CORE_BADGE_H, CORE_BADGE_W, CORE_BADGE_GAP } from './cause-roles.js';
import { must } from './must.js';
import { focusInk } from './emit-focus.js';
// The core driver (ADR 0015 D4): a thick frame and a small 中核 badge just outside the side of the box away from the arrows that leave it
const CORE_STROKE = 3.5, BADGE_W = CORE_BADGE_W, BADGE_H = CORE_BADGE_H, BADGE_GAP = CORE_BADGE_GAP;
// the label's line box (ascent + descent, about 1.45em: 20px at 14px) centred in the 22px badge: 1px clear at the top and the bottom. At
// y + 16 the line box touched the badge's top edge (and the lint read the label as spilling out of it by 4px, #378)
const BADGE_BASELINE = 17;
function coreBadge(n, id, b, day) {
    const leave = b.edges.find(e => e.from === id)?.points[0], eps = 1;
    const side = !leave ? 'top' : Math.abs(leave.y - n.y) < eps ? 'bottom' : Math.abs(leave.y - n.y - n.h) < eps ? 'top' : Math.abs(leave.x - n.x) < eps ? 'right' : 'left';
    // wholly outside the frame, so it never covers the label (H7)
    const x = side === 'left' ? n.x - BADGE_W - BADGE_GAP : side === 'right' ? n.x + n.w + BADGE_GAP : n.x + 6;
    const y = side === 'top' ? n.y - BADGE_H - BADGE_GAP : side === 'bottom' ? n.y + n.h + BADGE_GAP : n.y + 6;
    const fill = b.dim ? PALETTE.muted : colorOf('accent', day);
    // the label is placed from the badge as it is drawn (snapped once): snapping the text's own point to the 4px grid moved it up to 2px
    const bx = snap4(x), by = snap4(y);
    return `<rect x="${bx}" y="${by}" width="${BADGE_W}" height="${BADGE_H}" rx="8" fill="${fill}"/>\n  <text x="${bx + BADGE_W / 2}" y="${by + BADGE_BASELINE}" text-anchor="middle" font-size="14" font-weight="700" fill="${PALETTE.bg}">${escapeXml(b.coreBadge ?? '中核')}</text>`;
}
export function renderCause(b, day, tones) {
    const out = [];
    const stroke = b.dim ? PALETTE.muted : PALETTE.text;
    const cutsOf = (k) => {
        const mine = (b.crossings ?? []).filter(c => !c.skipped && c.over === k);
        return mine.length ? mine.map(c => ({ x: c.x, y: c.y, side: c.side, r: HOP_R })) : undefined;
    };
    const edgeInk = focusInk(b.focused, b.dim, day, stroke);
    // with focus, the lit arrows are drawn last (over the muted ones they cross)
    const order = b.edges.map((_, k) => k).toSorted((p, q) => Number(edgeInk(must(b.edges[p]).from, must(b.edges[p]).to) !== PALETTE.muted) - Number(edgeInk(must(b.edges[q]).from, must(b.edges[q]).to) !== PALETTE.muted));
    for (const k of b.focused ? order : b.edges.map((_, k) => k)) {
        const e = must(b.edges[k]), c = edgeInk(e.from, e.to);
        out.push(e.kind === 'blocks' ? arrowPath(e.points, c, e.line, 2, 'end', 'bar', cutsOf(k)) : e.back ? arrowPath(e.points, c, e.line, 3, 'end', 'arrow', cutsOf(k)) : arrowPath(e.points, c, e.line, 2, 'end', 'arrow', cutsOf(k)));
    }
    // the AND arc: across the arrows of one effect, just before their heads
    for (const a of b.ands)
        out.push(`<path d="M${snap4(a.p0.x)},${snap4(a.p0.y)} Q${snap4(a.c.x)},${snap4(a.c.y)} ${snap4(a.p1.x)},${snap4(a.p1.y)}" fill="none" stroke="${edgeInk(a.from, a.to)}" stroke-width="2"/>`);
    for (const [i, n] of b.nodes.entries()) {
        if (n.hex) { // an obstacle: a hexagon (pointed left and right), in its tone's colours
            const st = b.dim ? { fill: PALETTE.bg, stroke: PALETTE.muted, dashed: false } : resolveBoxStyle(tones, n.tone, day, n.dashed), k = Math.min(16, n.h / 2), cy = n.y + n.h / 2;
            const corners = [[n.x + k, n.y], [n.x + n.w - k, n.y], [n.x + n.w, cy], [n.x + n.w - k, n.y + n.h], [n.x + k, n.y + n.h], [n.x, cy]];
            const pts = corners.map(([px, py]) => `${snap4(px)},${snap4(py)}`).join(' ');
            out.push(`<polygon points="${pts}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${n.core ? CORE_STROKE : 2}"${st.dashed ? ' stroke-dasharray="6,4"' : ''} stroke-linejoin="round"/>`);
            if (n.core)
                out.push(coreBadge(n, must(b.anchors[i]).id, b, day));
            continue;
        }
        const rect = renderBoxRect({ ...n, dim: b.dim }, day, tones, 'plain');
        out.push(n.core ? rect.replace('stroke-width="2.5"', `stroke-width="${CORE_STROKE}"`) : rect);
        if (n.double) {
            const inner = renderBoxRect({ x: n.x + 4, y: n.y + 4, w: n.w - 8, h: n.h - 8, tone: n.tone, dim: b.dim }, day, tones, 'plain').replace('rx="8"', 'rx="5"');
            // on a solid fill the inner outline would be the fill colour: drawn in the text colour (white), as a state's end outline is
            out.push(!b.dim && isSolidTone(n.tone) ? inner.replace(/stroke="[^"]*"/, `stroke="${colorOf(toneStyle(tones, n.tone).text, day)}"`) : inner);
        }
        if (n.core)
            out.push(coreBadge(n, must(b.anchors[i]).id, b, day));
    }
    const ink = (t) => {
        if (b.dim)
            return PALETTE.muted;
        const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
        if (n && isSolidTone(n.tone))
            return colorOf(toneStyle(tones, n.tone).text, day); // white on the fill, the sub line too
        if (t.muted)
            return n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted;
        return colorOf(toneStyle(tones, n?.tone).text, day);
    };
    for (const t of b.texts)
        out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
    return out.join('\n  ');
}
