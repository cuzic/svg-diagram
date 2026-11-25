import {anchoredSpotlightTarget} from './emit-spotlight.ts';
import type {SpotlightHooks} from './band-def.ts';
import {PALETTE, colorOf, toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutQuadrant, QuadrantBand} from './quadrant.ts';
import {snap4, escapeAttr, emojiSpan} from './emit-common.ts';

import {must} from './must.ts';

// quadrant(): the cells, the crosshair, arrows, bubbles (a shape per group), the legend markers, then every text.
export function renderQuadrant(b: LaidOutQuadrant, day: Theme, tones: ToneEnv): string {
  const ink = (k: 'text' | 'muted' | 'accent' | 'danger', dim?: boolean) => dim ? PALETTE.muted : colorOf(k, day);
  const out: string[] = [];
  for (const c of b.cells) {
    const ts = toneStyle(tones, c.tone), fill = b.dim ? PALETTE.bg : colorOf(ts.fill, day);
    const stroke = b.dim ? PALETTE.muted : ts.stroke === null ? colorOf(ts.fill, day) : c.tone === 'plain' ? PALETTE.muted : colorOf(ts.stroke, day);
    // snap the edges, not the width: every gap between two cells comes out the same
    const x0 = snap4(c.x), y0 = snap4(c.y), x1 = snap4(c.x + c.w), y1 = snap4(c.y + c.h);
    out.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${b.crosshair ? 0 : 8}" fill="${fill}" stroke="${stroke}" stroke-width="2"${ts.dashed && !b.dim ? ' stroke-dasharray="6,4"' : ''}/>`);
  }
  for (const r of b.regions) {
    const ts = toneStyle(tones, r.tone), fill = b.dim ? PALETTE.bg : colorOf(ts.fill, day);
    const stroke = b.dim ? PALETTE.muted : ts.stroke === null ? colorOf(ts.fill, day) : r.tone === 'plain' ? PALETTE.muted : colorOf(ts.stroke, day);
    out.push(`<polygon points="${r.points.map(([px, py]) => `${snap4(px)},${snap4(py)}`).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"${ts.dashed && !b.dim ? ' stroke-dasharray="6,4"' : ''}/>`);
  }
  for (const l of b.lines) out.push(`<path d="M${snap4(l.x1)},${snap4(l.y1)} L${snap4(l.x2)},${snap4(l.y2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`); // on the snapped cell edges
  const head = (x: number, y: number, dx: number, dy: number, color: string): string => {
    const L = 10, W = 5, pts: [number, number][] = [[x, y], [x - dx * L - dy * W, y - dy * L + dx * W], [x - dx * L + dy * W, y - dy * L - dx * W]];
    return `<polygon points="${pts.map(([a, c]) => `${Math.round(a)},${Math.round(c)}`).join(' ')}" fill="${color}"/>`;
  };
  const shapeSvg = (shape: LaidOutQuadrant['bubbles'][number]['shape'], x: number, y: number, r: number, fill: string, stroke: string, sw: number, node?: string): string => {
    const f = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${node ? ` data-node="${escapeAttr(node)}"` : ''}`, n = (v: number) => Math.round(v * 10) / 10;
    if (shape === 'circle') return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" ${f}/>`;
    if (shape === 'square') { const s = r * Math.sqrt(Math.PI) / 2; return `<polygon points="${n(x - s)},${n(y - s)} ${n(x + s)},${n(y - s)} ${n(x + s)},${n(y + s)} ${n(x - s)},${n(y + s)}" ${f}/>`; }
    if (shape === 'diamond') { const s = r * Math.sqrt(Math.PI) / Math.SQRT2; return `<polygon points="${n(x)},${n(y - s)} ${n(x + s)},${n(y)} ${n(x)},${n(y + s)} ${n(x - s)},${n(y)}" ${f}/>`; }
    const a = r * Math.sqrt(4 * Math.PI / Math.sqrt(3)), hh = a * Math.sqrt(3) / 2, cy = y - hh / 3 * 0; // an equilateral triangle of area pi r^2, centred on its centroid
    return `<polygon points="${n(x)},${n(cy - hh * 2 / 3)} ${n(x + a / 2)},${n(cy + hh / 3)} ${n(x - a / 2)},${n(cy + hh / 3)}" ${f}/>`;
  };
  for (const a of b.arrows) {
    out.push(`<path d="M${Math.round(a.x1)},${Math.round(a.y1)} L${Math.round(a.x2)},${Math.round(a.y2)}" fill="none" stroke="${PALETTE.text}" stroke-width="2"${a.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    out.push(head(a.x2, a.y2, a.tip.dx, a.tip.dy, PALETTE.text));
  }
  for (const c of b.chips) out.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="4" fill="${PALETTE.bg}"/>`);
  // a hollow marker (groups 5 to 8) is an outline drawn inside the shape's area, so it is told from the filled ones by more than colour
  const marker = (shape: LaidOutQuadrant['bubbles'][number]['shape'], x: number, y: number, r: number, color: string, hollow: boolean | undefined, node?: string): string =>
    hollow ? shapeSvg(shape, x, y, r - 1.5, PALETTE.bg, color, 3, node) : shapeSvg(shape, x, y, r, color, PALETTE.bg, 1.5, node);
  for (const q of b.bubbles) out.push(marker(q.shape, q.x, q.y, q.r, ink(q.tone, q.dim), q.hollow, q.dataNode));
  for (const m of b.marks) out.push(m.ring ? shapeSvg(m.shape, m.x, m.y, m.r, 'none', ink(m.tone, b.dim), 2) : marker(m.shape, m.x, m.y, m.r, ink(m.tone, b.dim), m.hollow));
  for (const t of b.texts) {
    const dim = b.dim || (t.item !== undefined && must(b.bubbles[t.item]).dim);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t.fill, dim)}"${t.dataNode ? ` data-node="${escapeAttr(t.dataNode)}"` : ''}>${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}

export const quadrantSpotlight: SpotlightHooks<QuadrantBand, LaidOutQuadrant> = {
  targets: anchoredSpotlightTarget,
  dim(laid, focus) {
    if (focus.contains(laid)) return;
    for (const anchor of laid.anchors) {
      const bubble = laid.bubbles.find(b => b.id === anchor.id);
      if (bubble) bubble.dim = !focus.contains(anchor);
    }
    for (const bubble of laid.bubbles) if (bubble.dim === undefined) bubble.dim = true;
    laid.dim = laid.bubbles.every(b => b.dim);
  },
};
