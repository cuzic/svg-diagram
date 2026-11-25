import { emojiSpan, snap4 } from './emit-common.js';
import { must } from './must.js';
import { GANTT_AXIS, partAttr, partsOn } from './parts.js';
import { PALETTE } from './tokens.js';
export function ganttBarGeometry({ x, y, w, h }) {
    return { x: snap4(x), y: snap4(y), w: snap4(w), h };
}
export function renderGantt(b, day) {
    const out = [], on = partsOn(b), pa = (part) => part ? partAttr(on, part) : '', axis = pa(GANTT_AXIS);
    const ink = b.dim ? PALETTE.muted : PALETTE.text;
    const tone = (t) => b.dim ? PALETTE.muted : t === 'accent' ? PALETTE[day].accent : t === 'danger' ? PALETTE.danger : PALETTE.muted;
    const soft = (t) => b.dim ? PALETTE.bg : t === 'accent' ? PALETTE[day].soft : PALETTE.border;
    for (const s of b.sections)
        out.push(`<rect x="${snap4(s.x)}" y="${snap4(s.y)}" width="${snap4(s.w)}" height="${s.h}" fill="${PALETTE.code}"${pa(s.part)}/>`);
    for (const t of b.ticks)
        out.push(`<path d="M${snap4(t.x)},${snap4(b.plot.y1)} V${snap4(b.plot.y2)}" fill="none" stroke="${PALETTE.border}" stroke-width="1"${axis}/>`);
    out.push(`<path d="M${snap4(b.plot.x1)},${snap4(b.plot.y1)} H${snap4(b.plot.x2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"${axis}/>`);
    for (const d of b.deps) {
        const pts = d.points.slice(), n = pts.length, tip = must(pts[n - 1]), prev = must(pts[n - 2]), L = 8, W = 4;
        const dx = Math.sign(tip.x - prev.x), dy = Math.sign(tip.y - prev.y);
        pts[n - 1] = { x: tip.x - dx * (L - 1), y: tip.y - dy * (L - 1) };
        out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${ink}" stroke-width="1.5"/>\n  <path d="M${snap4(tip.x)},${snap4(tip.y)} L${snap4(tip.x - dx * L - dy * W)},${snap4(tip.y - dy * L + dx * W)} L${snap4(tip.x - dx * L + dy * W)},${snap4(tip.y - dy * L - dx * W)} z" fill="${ink}"/>`);
    }
    for (const r of b.bars) {
        if (r.milestone) {
            const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
            out.push(`<path d="M${snap4(cx)},${snap4(r.y)} L${snap4(r.x + r.w)},${snap4(cy)} L${snap4(cx)},${snap4(r.y + r.h)} L${snap4(r.x)},${snap4(cy)} z" fill="${tone(r.tone)}" stroke="${PALETTE.bg}" stroke-width="2"${pa(r.part)}/>`);
            continue;
        }
        const { x, y, w, h } = ganttBarGeometry(r);
        if (r.progress === undefined)
            out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${tone(r.tone)}"${pa(r.part)}/>`);
        else {
            out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${soft(r.tone)}" stroke="${tone(r.tone)}" stroke-width="2"${pa(r.part)}/>`);
            if (r.progress > 0)
                out.push(`<rect x="${x}" y="${y}" width="${snap4(r.w * r.progress)}" height="${h}" rx="4" fill="${tone(r.tone)}"${pa(r.part)}/>`);
        }
    }
    if (b.today)
        out.push(`<path d="M${snap4(b.today.x)},${snap4(b.today.y1)} V${snap4(b.today.y2)}" fill="none" stroke="${b.dim ? PALETTE.muted : PALETTE.danger}" stroke-width="2"${pa(b.today.part)}/>`);
    for (const t of b.texts)
        out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'middle' ? ' text-anchor="middle"' : t.anchor === 'end' ? ' text-anchor="end"' : ''} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${b.dim ? PALETTE.muted : t.tone === 'danger' ? PALETTE.danger : t.muted ? PALETTE.muted : PALETTE.text}"${pa(t.part)}>${emojiSpan(t.text)}</text>`);
    return out.join('\n  ');
}
