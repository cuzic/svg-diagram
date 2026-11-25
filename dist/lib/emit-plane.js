import { PALETTE } from './tokens.js';
import { visibleAt } from './reveal-visibility.js';
import { snap4, emojiSpan, resolveTextColor } from './emit-common.js';
import { must } from './must.js';
import { marked, partAttr, partsOn, PLANE_AXES } from './parts.js';
// plane(): axes (with arrowheads), ticks, guides, points, dimension lines with their label chips, then every text.
export function renderPlane(b, day, tones, stage) {
    const col = (t) => resolveTextColor(tones, t, day);
    const seg = (s) => `M${Math.round(s.x1)},${Math.round(s.y1)} L${Math.round(s.x2)},${Math.round(s.y2)}`;
    // a filled arrowhead at (x, y) pointing along (dx, dy); drawn as a polygon so it needs no <marker>
    const head = (x, y, dx, dy, color) => {
        const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, L = 10, W = 5;
        const pts = [[x, y], [x - ux * L - uy * W, y - uy * L + ux * W], [x - ux * L + uy * W, y - uy * L - ux * W]];
        return `<polygon points="${pts.map(([a, c]) => `${Math.round(a)},${Math.round(c)}`).join(' ')}" fill="${color}"/>`;
    };
    // ADR 0054: the axes (lines, heads, ticks, their texts) are one part, a series' line, markers and name another
    const on = partsOn(b), pa = (part) => part ? partAttr(on, part) : '', axes = pa(PLANE_AXES);
    const out = [];
    if (b.grid.length)
        out.push(`<path d="${b.grid.map(seg).join(' ')}" fill="none" stroke="${PALETTE.border}" stroke-width="2"/>`);
    const yEnd = b.yDown ? b.plotB : b.plotT, xEnd = b.plotR;
    out.push(`<path d="${seg({ x1: b.axisX, y1: b.axisY, x2: xEnd, y2: b.axisY })} ${seg({ x1: b.axisX, y1: b.axisY, x2: b.axisX, y2: yEnd })}" fill="none" stroke="${PALETTE.text}" stroke-width="2"${axes}/>`);
    out.push(marked(head(xEnd, b.axisY, 1, 0, PALETTE.text), axes), marked(head(b.axisX, yEnd, 0, b.yDown ? 1 : -1, PALETTE.text), axes));
    if (b.ticks.length)
        out.push(`<path d="${b.ticks.map(seg).join(' ')}" fill="none" stroke="${PALETTE.text}" stroke-width="2"${axes}/>`);
    for (const l of b.lines.filter(l => visibleAt(l, stage))) {
        const c = col(l.tone);
        out.push(`<path d="${seg(l)}" fill="none" stroke="${c}" stroke-width="2"${l.dashed ? ' stroke-dasharray="6,4"' : ''}${pa(l.part)}/>`);
        if (l.arrow)
            out.push(marked(head(l.x2, l.y2, l.x2 - l.x1, l.y2 - l.y1, c), pa(l.part)));
    }
    for (const path of (b.paths ?? []).filter(p => visibleAt(p, stage))) {
        const pa = path, mark = path.part ? partAttr(on, path.part) : '';
        const c = col(pa.tone), r = (q) => `${Math.round(q.x)},${Math.round(q.y)}`;
        // a growing path shows its first `k` pieces at this stage (the full path, or no stage: all of them)
        const total = pa.pts.length - 1;
        const k = pa.segReveal && stage !== undefined ? pa.segReveal.filter(s => s <= stage).length : total;
        if (k < 1)
            continue;
        const full = k >= total;
        const d = `M${r(must(pa.pts[0]))} ` + (pa.curves.length ? pa.curves.slice(0, k).map(([c1, c2, e]) => `C${r(must(c1))} ${r(must(c2))} ${r(must(e))}`) : pa.pts.slice(1, k + 1).map(q => `L${r(q)}`)).join(' ');
        out.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="2"${pa.dashed ? ' stroke-dasharray="6,4"' : ''}${mark}/>`);
        if (pa.arrow && full)
            out.push(marked(head(must(pa.pts[pa.pts.length - 1]).x, must(pa.pts[pa.pts.length - 1]).y, pa.tip.dx, pa.tip.dy, c), mark));
    }
    for (const dm of b.dims.filter(dm => visibleAt(dm, stage))) {
        const c = col(dm.tone);
        for (const e of dm.ext)
            out.push(`<path d="${seg(e)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="2,4" stroke-linecap="round"/>`);
        out.push(`<path d="${seg(dm.line)}" fill="none" stroke="${c}" stroke-width="2"/>`);
        out.push(head(dm.line.x1, dm.line.y1, dm.line.x1 - dm.line.x2, dm.line.y1 - dm.line.y2, c), head(dm.line.x2, dm.line.y2, dm.line.x2 - dm.line.x1, dm.line.y2 - dm.line.y1, c));
        out.push(`<rect x="${snap4(dm.chip.x)}" y="${snap4(dm.chip.y)}" width="${snap4(dm.chip.x + dm.chip.w) - snap4(dm.chip.x)}" height="${dm.chip.h}" rx="${dm.chip.h / 2}" fill="${PALETTE.bg}"/>`);
    }
    for (const p of b.points.filter(p => visibleAt(p, stage))) {
        const c = col(p.tone), x = snap4(p.x), y = snap4(p.y), at = out.length;
        if (p.shape === 'ring')
            out.push(`<circle cx="${x}" cy="${y}" r="6" fill="${PALETTE.bg}" stroke="${c}" stroke-width="2.5"/>`);
        else if (p.shape === 'cross')
            out.push(`<path d="M${x - 6},${y - 6} L${x + 6},${y + 6} M${x - 6},${y + 6} L${x + 6},${y - 6}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`);
        else if (p.shape === 'disc' || p.shape === 'hole') {
            const ex = Math.round(p.x), ey = Math.round(p.y);
            out.push(`<path d="M${ex - 6},${ey} a6,6 0 1 0 12,0 a6,6 0 1 0 -12,0 Z" fill="${p.shape === 'hole' ? PALETTE.bg : c}"${p.shape === 'hole' ? ` stroke="${c}" stroke-width="2.5"` : ''}/>`);
        }
        else if (p.shape === 'square' || p.shape === 'diamond' || p.shape === 'triangle') {
            const ex = Math.round(p.x), ey = Math.round(p.y);
            const d = p.shape === 'square' ? `M${ex - 6},${ey - 6} H${ex + 6} V${ey + 6} H${ex - 6} Z` : p.shape === 'diamond' ? `M${ex},${ey - 8} L${ex + 8},${ey} L${ex},${ey + 8} L${ex - 8},${ey} Z` : `M${ex},${ey - 8} L${ex + 8},${ey + 6} L${ex - 8},${ey + 6} Z`;
            out.push(`<path d="${d}" fill="${c}"/>`);
        }
        else
            out.push(`<circle cx="${x}" cy="${y}" r="6" fill="${c}"/>`);
        if (p.part)
            out[at] = marked(must(out[at]), pa(p.part));
    }
    for (const t of b.texts.filter(t => visibleAt(t, stage))) {
        out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${b.labelSize}"${t.bold ? ' font-weight="700"' : ''} fill="${col(t.tone)}"${pa(t.part)}>${emojiSpan(t.s)}</text>`);
    }
    return out.join('\n  ');
}
