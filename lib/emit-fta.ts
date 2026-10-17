// The drawing of a fault tree (ADR 0025): event boxes, the gates (distinctive shapes: AND = flat base and round top, OR = pointed shield,
// vote = OR with k/n, inhibit = hexagon) and the symbol of each leaf event. The lines have no arrowheads: they join a gate to what it takes,
// they are not cause-to-effect arrows.
import {PALETTE, colorOf, toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutFta} from './types/diagrams.ts';
import {snap4, emojiSpan} from './emit-common.ts';
import {renderBoxRect} from './emit-boxes.ts';
import {pillSvg} from './badge.ts';

type R = {x: number; y: number; w: number; h: number};

/** The outline of a gate in rectangle r (output at the top, inputs along the bottom). */
export function gatePath(gate: 'and' | 'or' | 'vote' | 'inhibit', r: R): string {
  const {x, y, w, h} = r, n = snap4, mx = x + w / 2;
  if (gate === 'and') return `M${n(x)},${n(y + h)} V${n(y + h * 0.45)} A${n(w / 2)},${n(h * 0.45)} 0 0 1 ${n(x + w)},${n(y + h * 0.45)} V${n(y + h)} Z`;
  if (gate === 'inhibit') return `M${n(mx)},${n(y)} L${n(x + w)},${n(y + h * 0.25)} L${n(x + w)},${n(y + h * 0.75)} L${n(mx)},${n(y + h)} L${n(x)},${n(y + h * 0.75)} L${n(x)},${n(y + h * 0.25)} Z`;
  return `M${n(x)},${n(y + h)} Q${n(mx)},${n(y + h * 0.66)} ${n(x + w)},${n(y + h)} Q${n(x + w)},${n(y + h * 0.32)} ${n(mx)},${n(y)} Q${n(x)},${n(y + h * 0.32)} ${n(x)},${n(y + h)} Z`;
}

/** The symbol of a leaf event in rectangle r. */
export function markPath(kind: 'basic' | 'undeveloped' | 'house' | 'condition' | 'event', r: R): string {
  const {x, y, w, h} = r, n = snap4, cx = x + w / 2, cy = y + h / 2;
  if (kind === 'undeveloped') return `M${n(cx)},${n(y)} L${n(x + w)},${n(cy)} L${n(cx)},${n(y + h)} L${n(x)},${n(cy)} Z`;
  if (kind === 'house') return `M${n(x)},${n(y + h)} V${n(y + h * 0.4)} L${n(cx)},${n(y)} L${n(x + w)},${n(y + h * 0.4)} V${n(y + h)} Z`;
  const rx = kind === 'condition' ? w / 2 : Math.min(w, h) / 2, ry = h / 2;
  return `M${n(cx - rx)},${n(cy)} A${n(rx)},${n(ry)} 0 1 0 ${n(cx + rx)},${n(cy)} A${n(rx)},${n(ry)} 0 1 0 ${n(cx - rx)},${n(cy)} Z`;
}

/** A legend sample of a fault-tree symbol (an event's or a gate's), at the left of an item whose line is at `cy`.
 *  Sizes are multiples of 4 so the snapped arc radii still fit their chords (an arc radius below half its chord is scaled up, not drawn as asked). */
export function ftaLegendSwatch(it: {x: number; ftaEvent?: 'basic' | 'undeveloped' | 'house' | 'condition'; ftaGate?: 'and' | 'or' | 'vote' | 'inhibit'}, cy: number): string {
  const wide = it.ftaEvent === 'condition', w = wide || it.ftaGate ? 32 : 24;
  const r = {x: it.x + 2 + (32 - w) / 2 + (it.ftaGate || wide ? 0 : 4), y: cy - 12, w, h: 24};
  const d = it.ftaGate ? gatePath(it.ftaGate, r) : markPath(it.ftaEvent as 'basic', r);
  return `<path d="${d}" fill="${PALETTE.bg}" stroke="${PALETTE.text}" stroke-width="2"/>`;
}

export function renderFta(b: LaidOutFta, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  const ink = b.dim ? PALETTE.muted : PALETTE.text;
  for (const e of b.edges) out.push(`<path d="M${e.points.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  for (const g of b.gates) {
    out.push(`<path d="${gatePath(g.gate, g)}" fill="${PALETTE.bg}" stroke="${ink}" stroke-width="2"/>`);
    if (g.label) out.push(`<text x="${Math.round(g.x + g.w / 2)}" y="${Math.round(g.y + g.h * 0.72)}" text-anchor="middle" font-size="${g.label.size}" fill="${ink}">${emojiSpan(g.label.text)}</text>`);
  }
  const alert = b.dim ? PALETTE.muted : PALETTE.danger;
  for (const m of b.marks) out.push(`<path d="${markPath(m.kind, m)}" fill="${PALETTE.bg}" stroke="${m.single ? alert : ink}" stroke-width="${m.single ? 4 : 2}"/>`);
  for (const t of b.badges) out.push(pillSvg({x: snap4(t.x), y: snap4(t.y), w: snap4(t.x + t.w) - snap4(t.x), h: t.h, fill: alert, cx: t.x + t.w / 2, baseline: t.y + t.h / 2 + t.size * 0.36, text: PALETTE.bg, size: t.size, labelHtml: emojiSpan(t.text)}));
  for (const n of b.nodes) out.push(renderBoxRect({...n, tone: 'plain', dim: b.dim}, day, tones, 'plain'));
  for (const t of b.texts) {
    const fill = b.dim ? PALETTE.muted : t.muted ? PALETTE.muted : colorOf(toneStyle(tones, 'plain').text, day);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${fill}">${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}
