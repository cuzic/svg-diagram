// The drawing of a fault tree (ADR 0025): event boxes, the gates (distinctive shapes: AND = flat base and round top, OR = pointed shield,
// vote = OR with k/n, inhibit = hexagon) and the symbol of each leaf event. The lines have no arrowheads: they join a gate to what it takes,
// they are not cause-to-effect arrows.
import {marked, partAttr, partsOn} from './parts.ts';
import {PALETTE, colorOf, toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutFta} from './types/diagrams.ts';
import {snap4, emojiSpan} from './emit-common.ts';
import {renderBoxRect} from './emit-box-frame.ts';
import {pillSvg} from './badge.ts';

import {gatePath, markPath} from './emit-fta-symbols.ts';
export {gatePath, markPath, ftaLegendSwatch} from './emit-fta-symbols.ts';

export function renderFta(b: LaidOutFta, day: Theme, tones: ToneEnv): string {
  const out: string[] = [], on = partsOn(b), pa = (part?: string): string => part ? partAttr(on, part) : '';
  const ink = b.dim ? PALETTE.muted : PALETTE.text;
  for (const e of b.edges) out.push(`<path d="M${e.points.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"${pa(e.part)}/>`);
  for (const g of b.gates) {
    out.push(`<path d="${gatePath(g.gate, g)}" fill="${PALETTE.bg}" stroke="${ink}" stroke-width="2"${pa(g.part)}/>`);
    if (g.label) out.push(`<text x="${Math.round(g.x + g.w / 2)}" y="${Math.round(g.y + g.h * 0.72)}" text-anchor="middle" font-size="${g.label.size}" fill="${ink}"${pa(g.part)}>${emojiSpan(g.label.text)}</text>`);
  }
  const alert = b.dim ? PALETTE.muted : PALETTE.danger;
  for (const m of b.marks) out.push(`<path d="${markPath(m.kind, m)}" fill="${PALETTE.bg}" stroke="${m.single ? alert : ink}" stroke-width="${m.single ? 4 : 2}"${pa(m.part)}/>`);
  for (const t of b.badges) out.push(marked(pillSvg({x: snap4(t.x), y: snap4(t.y), w: snap4(t.x + t.w) - snap4(t.x), h: t.h, fill: alert, cx: t.x + t.w / 2, baseline: t.y + t.h / 2 + t.size * 0.36, rawY: t.y, text: PALETTE.bg, size: t.size, labelHtml: emojiSpan(t.text)}), pa(t.part)));
  for (const n of b.nodes) out.push(marked(renderBoxRect({...n, tone: 'plain', dim: b.dim}, day, tones, 'plain'), pa(n.part)));
  for (const t of b.texts) {
    const fill = b.dim ? PALETTE.muted : t.muted ? PALETTE.muted : colorOf(toneStyle(tones, 'plain').text, day);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${fill}"${pa(t.part)}>${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}
