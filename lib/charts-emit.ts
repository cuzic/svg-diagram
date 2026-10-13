// The SVG of a chart band: its rects, paths and texts in the order the layout made them (what comes later is drawn over what came
// before). Spotlight: an element whose anchor is dimmed is drawn outline-only in the muted colour; the rest of the figure stays.
import {PALETTE, colorOf} from './tokens.ts';
import {visibleAt} from './reveal.ts';
import type {LaidOutChart} from './charts.ts';
import type {ColorKey, Theme} from './types.ts';

const r2 = (n: number): number => Math.round(n * 100) / 100;
export function renderChart(b: LaidOutChart, day: Theme, emojiSpan: (s: string) => string, stage?: number, dimFill = false): string {
  const col = (k: ColorKey): string => colorOf(k, day);
  // an element belongs to one anchor or to several (a ribbon to both of its nodes): it dims when every one of them is dimmed
  const dimmed = (of: string | string[] | undefined): boolean => !!b.dim || (of !== undefined && [of].flat().every(k => !!b.dimIds?.includes(k)));
  const out: string[] = [];
  for (const it of b.items) {
    const dim = dimmed(it.of);
    if (it.k === 'rect') {
      const x = r2(it.x), y = r2(it.y), right = r2(it.x + it.w), bottom = r2(it.y + it.h);
      const d = `M${x},${y} H${right} V${bottom} H${x} Z`;
      if (dim && it.fill !== 'none') {
        if (dimFill) out.push(`<path d="${d}" fill="${PALETTE.border}"/>`);
        else {
          const thin = it.w < 1 || it.h < 1, i = thin ? 0 : Math.min(1, it.w / 2, it.h / 2);
          out.push(`<path d="M${x + i},${y + i} H${right - i} V${bottom - i} H${x + i} Z" fill="${PALETTE.bg}"${thin ? '' : ` stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="2,5" stroke-linecap="round"`}/>`);
        }
        continue;
      }
      const fill = it.fill === 'none' ? 'none' : col(it.fill), op = it.op !== undefined && it.fill !== 'none' ? ` fill-opacity="${it.op}"` : '';
      const stroke = it.stroke ? ` stroke="${dim ? PALETTE.muted : col(it.stroke)}" stroke-width="${it.sw ?? 2}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''}` : '';
      // a shade is the colour at an opacity: over the page colour, so the grid behind it does not show through
      if (op) out.push(`<path d="${d}" fill="${PALETTE.bg}"/>`);
      out.push(`<path d="${d}" fill="${fill}"${op}${stroke}/>`);
    } else if (it.k === 'path') {
      const fill = it.fill === 'none' ? 'none' : dim ? PALETTE.muted : col(it.fill), op = it.op !== undefined && it.fill !== 'none' ? ` fill-opacity="${dim ? 0.15 : it.op}"` : '';
      const stroke = it.stroke ? ` stroke="${dim ? PALETTE.muted : col(it.stroke)}" stroke-width="${it.sw ?? 2}" stroke-linejoin="round"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''}` : '';
      out.push(`<path d="${it.d}" fill="${fill}"${op}${stroke}/>`);
    } else {
      if (it.of !== undefined && !visibleAt(b, stage)) continue;
      const anchor = it.anchor === 'start' ? '' : ` text-anchor="${it.anchor}"`;
      out.push(`<text x="${it.x}" y="${it.y}"${anchor} font-size="${it.size}"${it.bold ? ' font-weight="700"' : ''} fill="${dim ? PALETTE.muted : col(it.fill)}">${emojiSpan(it.s)}</text>`);
    }
  }
  return out.join('\n  ');
}
