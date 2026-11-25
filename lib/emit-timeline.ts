import {PALETTE, colorOf} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutTimeline} from './types/timeline.ts';
import {snap4, emojiSpan} from './emit-common.ts';

export function renderTimeline(b: LaidOutTimeline, day: Theme): string {
  // a dimmed timeline draws itself muted (so the white knock-out ring around each dot stays white)
  const col = (k: 'text' | 'muted' | 'accent' | 'danger') => b.dim ? PALETTE.muted : colorOf(k, day);
  const out: string[] = [`<path d="M${snap4(b.axis.x1)},${snap4(b.axis.y)} H${snap4(b.axis.x2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`];
  if (b.span?.fill) {
    const x1 = snap4(b.span.x1), y1 = snap4(b.span.y - 12);
    out.unshift(`<rect x="${x1}" y="${y1}" width="${snap4(b.span.x2) - x1}" height="24" fill="${b.span.tone === 'accent' && !b.dim ? PALETTE[day].soft : PALETTE.border}"/>`);
  } else if (b.span) out.push(`<path d="M${snap4(b.span.x1)},${snap4(b.span.y)} H${snap4(b.span.x2)}" fill="none" stroke="${col(b.span.tone)}" stroke-width="8"/>`);
  for (const g of b.guides ?? []) out.push(`<path d="M${snap4(g.x1)},${snap4(g.y)} H${snap4(g.x2)}" fill="none" stroke="${PALETTE.border}" stroke-width="1"/>`);
  for (const r of b.bars ?? []) out.push(`<rect x="${snap4(r.x)}" y="${snap4(r.y)}" width="${snap4(r.x + r.w) - snap4(r.x)}" height="${r.h}" fill="${col(r.tone)}" fill-opacity="0.18" stroke="${col(r.tone)}" stroke-width="2"/>`);
  for (const d of b.dims ?? []) out.push(`<path d="M${snap4(d.x1)},${snap4(d.y)} H${snap4(d.x2)} M${snap4(d.x1)},${snap4(d.y - 5)} V${snap4(d.y + 5)} M${snap4(d.x2)},${snap4(d.y - 5)} V${snap4(d.y + 5)}" fill="none" stroke="${col(d.tone)}" stroke-width="2"/>`);
  if (b.fullLine) out.push(`<path d="M${snap4(b.fullLine.x)},${snap4(b.fullLine.y1)} V${snap4(b.fullLine.y2)}" fill="none" stroke="${col('danger')}" stroke-width="2"/>`);
  for (const t of b.ticks) out.push(`<path d="M${snap4(t.x)},${snap4(t.y1)} V${snap4(t.y2)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  for (const s of b.stems) out.push(`<path d="M${snap4(s.x)},${snap4(s.y1)} V${snap4(s.y2)}" fill="none" stroke="${col(s.tone)}" stroke-width="2"/>`);
  for (const d of b.dots) out.push(`<circle cx="${snap4(d.x)}" cy="${snap4(d.y)}" r="${d.r}" fill="${col(d.tone)}" stroke="${PALETTE.bg}" stroke-width="4"/>`);
  if (b.bracket) { const {x1, x2, y, tone} = b.bracket; out.push(`<path d="M${snap4(x1)},${snap4(y - 4)} V${snap4(y)} H${snap4(x2)} V${snap4(y - 4)}" fill="none" stroke="${col(tone)}" stroke-width="2"/>`); }
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${col(t.fill)}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}
