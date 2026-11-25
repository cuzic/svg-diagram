import {anchoredSpotlightTarget} from './emit-spotlight.ts';
import type {SpotlightHooks} from './band-def.ts';
import {PALETTE, colorOf} from './tokens.ts';
import type {LaidOutBars, BarsBand} from './types/bars.ts';
import type {Theme, ColorKey} from './types/core.ts';
import {visibleAt} from './reveal-visibility.ts';
import {emojiSpan} from './emit-common.ts';

import {must} from './must.ts';
import {marked, partAttr, partsOn, PLANE_AXES} from './parts.ts';

export function renderBars(b: LaidOutBars, day: Theme, stage?: number, dimFill = false): string {
  const col = (k: ColorKey) => colorOf(k, day);
  // ADR 0054: the ticks and grid are the axes' part; a bar's shapes and texts its part; the overlays theirs
  const out: string[] = [], on = partsOn(b), pa = (part?: string): string => part ? partAttr(on, part) : '';
  for (const t of b.ticks) out.push(`<path d="M${Math.round(t.x1)},${Math.round(t.y1)} L${Math.round(t.x2)},${Math.round(t.y2)}" fill="none" stroke="${b.dim ? PALETTE.muted : PALETTE.border}" stroke-width="2"${pa(PLANE_AXES)}/>`);
  for (const r of b.bars.filter(r => visibleAt(r, stage))) {
    const at = out.length;
    drawBar(r);
    for (let i = at; i < out.length; i++) out[i] = marked(must(out[i]), pa(r.part));
  }
  function drawBar(r: LaidOutBars['bars'][number]): void {
    const x = Math.round(r.x * 100) / 100, y = Math.round(r.y * 100) / 100;
    const right = Math.round((r.x + r.w) * 100) / 100, bottom = Math.round((r.y + r.h) * 100) / 100;
    if (!r.dim) { out.push(`<path d="M${x},${y} H${right} V${bottom} H${x} Z" fill="${col(r.fill)}"/>`); return; }
    // spotlight dim 'fill': a pale fill (the border colour) keeps the bar's length readable
    if (dimFill) { out.push(`<path d="M${x},${y} H${right} V${bottom} H${x} Z" fill="${PALETTE.border}"/>`); return; }
    // a dimmed bar is outlined just inside its rect (so the gap between stacked segments stays open); one too thin to see stays a bare fill
    const thin = r.w < 1 || r.h < 1, i = thin ? 0 : Math.min(1, r.w / 2, r.h / 2);
    out.push(`<path d="M${x + i},${y + i} H${right - i} V${bottom - i} H${x + i} Z" fill="${PALETTE.bg}"${thin ? '' : ` stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="2,5" stroke-linecap="round"`}/>`);
  }
  // reference lines, the cumulative line and the curve of a bars() that has them
  const inkOf = (k: ColorKey) => b.dim ? PALETTE.muted : col(k);
  for (const l of b.ink?.lines ?? []) out.push(`<path d="M${Math.round(l.x1)},${Math.round(l.y1)} L${Math.round(l.x2)},${Math.round(l.y2)}" fill="none" stroke="${inkOf(l.fill)}" stroke-width="2"${l.dashed ? ' stroke-dasharray="6,4"' : ''}${pa(l.part)}/>`);
  for (const l of b.ink?.polylines ?? []) out.push(`<path d="M${l.pts.map(p => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(' L')}" fill="none" stroke="${inkOf(l.fill)}" stroke-width="2.5" stroke-linejoin="round"${l.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
  // a dot sits exactly on the vertex of the line it marks, so it is a path (a <circle> would be snapped to the 4px grid)
  for (const d of b.ink?.dots ?? []) { const x = Math.round(d.x * 10) / 10, y = Math.round(d.y * 10) / 10; out.push(`<path d="M${x - 4},${y} a4,4 0 1 0 8,0 a4,4 0 1 0 -8,0 Z" fill="${PALETTE.bg}" stroke="${inkOf(d.fill)}" stroke-width="2.5"${pa(d.part)}/>`); }
  for (const t of b.texts.filter(t => visibleAt(t, stage))) {
    const anchor = t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`;
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${anchor} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${t.dim || b.dim ? PALETTE.muted : col(t.fill)}"${pa(t.bar !== undefined ? b.bars[t.bar]?.part : t.part)}>${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}

export const barsSpotlight: SpotlightHooks<BarsBand, LaidOutBars> = {
  targets: anchoredSpotlightTarget,
  dim(laid, focus) {
    if (focus.contains(laid)) return;
    for (const bar of laid.bars) bar.dim = !focus.contains(bar);
    for (const text of laid.texts) if (text.bar !== undefined) text.dim = must(laid.bars[text.bar]).dim;
    // The axis dims only when no bar is lit.
    laid.dim = laid.bars.every(bar => bar.dim);
  },
};
