import { PALETTE, colorOf, toneStyle, isSolidTone } from './tokens.js';
import { snap4, emojiSpan, resolveBoxStyle } from './emit-common.js';
import { renderBoxRect } from './emit-box-frame.js';
import { must } from './must.js';
import { marked, partAttr, partStep, partsOn } from './parts.js';
import { focusInk } from './emit-focus.js';
export function renderClasses(b, day, tones) {
    const out = [];
    const plainInk = b.dim ? PALETTE.muted : PALETTE.text, bg = PALETTE.bg, edgeInk = focusInk(b.focused, b.dim, day, plainInk);
    // ADR 0054: a class (its box, dividers and lines of text), and a relation (its line, end mark and labels)
    const on = partsOn(b), cls = (i) => i === undefined ? '' : partAttr(on, partStep('class', b.anchors[i]?.id ?? i, b.labelBoxes[i]?.label ?? ''));
    const named = new Map(b.anchors.map((a, i) => [a.id, b.labelBoxes[i]?.label ?? a.id]));
    const rel = (i) => { const e = b.edges[i]; return partAttr(on, partStep('relation', i, e ? `${named.get(e.from) ?? e.from} → ${named.get(e.to) ?? e.to}` : '')); };
    for (const [ei, e] of b.edges.entries()) {
        const mark = rel(ei);
        const ink = edgeInk(e.from, e.to);
        const pts = e.points, n = pts.length, first = must(pts[0]), second = must(pts[1]), tip = must(pts[n - 1]), prev = must(pts[n - 2]);
        out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${ink}" stroke-width="2"${e.line === 'dashed' ? ' stroke-dasharray="6,4"' : ''}${mark}/>`);
        const at = (p, q, L, W, shape, fill) => {
            // the mark sits at p, pointing away from q (its body runs back toward q)
            const dx = Math.sign(p.x - q.x), dy = Math.sign(p.y - q.y), f = (a, c) => `${snap4(p.x - dx * a - dy * c)},${snap4(p.y - dy * a + dx * c)}`;
            if (shape === 'open')
                return `<path d="M${f(L, W)} L${snap4(p.x)},${snap4(p.y)} L${f(L, -W)}" fill="none" stroke="${ink}" stroke-width="2"/>`;
            return `<path d="M${snap4(p.x)},${snap4(p.y)} L${f(shape === 'tri' ? L : L / 2, W)} ${shape === 'dia' ? `L${f(L, 0)} ` : ''}L${f(shape === 'tri' ? L : L / 2, -W)} z" fill="${fill}" stroke="${ink}" stroke-width="2"/>`;
        };
        if (e.kind === 'inherit' || e.kind === 'implement')
            out.push(marked(at(tip, prev, 14, 8, 'tri', bg), mark));
        else if (e.kind === 'arrow' || e.kind === 'depend')
            out.push(marked(at(tip, prev, 12, 6, 'open', bg), mark));
        else if (e.kind === 'compose')
            out.push(marked(at(first, second, 20, 7, 'dia', ink), mark));
        else if (e.kind === 'aggregate')
            out.push(marked(at(first, second, 20, 7, 'dia', bg), mark));
    }
    const tone = (t) => colorOf(toneStyle(tones, t).text, day);
    for (const [i, nd] of b.nodes.entries()) {
        out.push(marked(renderBoxRect({ ...nd, dim: b.dim }, day, tones, 'plain'), cls(i)));
        for (const y of nd.dividers)
            out.push(`<path d="M${snap4(nd.x)},${snap4(y)} H${snap4(nd.x + nd.w)}" fill="none" stroke="${b.dim ? PALETTE.muted : isSolidTone(nd.tone) ? colorOf(toneStyle(tones, nd.tone).text, day) : resolveBoxStyle(tones, nd.tone, day).stroke}" stroke-width="2"${cls(i)}/>`);
    }
    for (const t of b.texts) {
        const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
        out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'middle' ? ' text-anchor="middle"' : ''} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${b.dim ? PALETTE.muted : n && isSolidTone(n.tone) ? tone(n.tone) : t.muted ? (n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted) : tone(n?.tone)}"${cls(t.owner)}>${emojiSpan(t.text)}</text>`);
    }
    for (const l of b.labels) {
        out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${l.h}" fill="${bg}"${rel(l.edge)}/>`);
        out.push(`<text x="${Math.round(l.tx)}" y="${Math.round(l.ty + snap4(l.y) - l.y)}" text-anchor="middle" font-size="${l.size}" fill="${plainInk}"${rel(l.edge)}>${emojiSpan(l.text)}</text>`);
    }
    return out.join('\n  ');
}
