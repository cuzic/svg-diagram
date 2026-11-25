import {PALETTE} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme, Roles} from './types/core.ts';
import type {LaidOutTable} from './types/sequence-table-swimlane.ts';
import {TBL} from './layout-table.ts';
import {lineH} from './seq-table-text.ts';
import {iconSvg} from './icon-svg.ts';
import {snap4, resolveTextColor, textLines, rrPath, resolveBoxStyle} from './emit-common.ts';
import {must} from './must.ts';

export function renderTable(band: LaidOutTable, day: Theme, tones: ToneEnv, roles: Roles): string {
  const parts: string[] = [];
  const R = 8;
  const last = band.rows.length - 1;
  const titled = !!band.titleBar;
  if (titled) {
    const t = band.titleBar as NonNullable<LaidOutTable['titleBar']>;
    parts.push(`<path d="${rrPath(band.x, t.y, band.w, t.h, {tl: R, tr: R})}" fill="${PALETTE[day].accent}"/>`);
    parts.push(textLines(t.lines, {x: band.x + 12, top: t.y + 8, size: roles.title, weight: 700, fill: PALETTE.bg}));
  }
  band.rows.forEach((row, i) => {
    const top = i === 0 && !titled, bottom = i === last;
    const corners = {tl: top ? R : 0, tr: top ? R : 0, bl: bottom ? R : 0, br: bottom ? R : 0};
    const fill = row.header ? PALETTE[day].soft : row.tone ? resolveBoxStyle(tones, row.tone, day).fill : PALETTE.bg;
    parts.push(`<path d="${rrPath(band.x, row.y, band.w, row.h, corners)}" fill="${fill}"/>`);
    // row-heading cell: always soft, whatever the row's tone; only the outer left corners round
    if (band.rowHeader && !row.header) parts.push(`<path d="${rrPath(band.x, row.y, must(band.colW[0]), row.h, {tl: corners.tl, bl: corners.bl})}" fill="${PALETTE[day].soft}"/>`);
    if (i > 0 || titled) parts.push(`<path d="M${Math.round(band.x)},${Math.round(row.y)} H${Math.round(band.x + band.w)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
  });
  const y0 = must(band.rows[0]).y, y1 = must(band.rows[last]).y + must(band.rows[last]).h;
  for (let i = 1; i < band.colX.length; i++) {
    parts.push(`<path d="M${Math.round(must(band.colX[i]))},${Math.round(y0)} V${Math.round(y1)}" stroke="${PALETTE.border}" stroke-width="2"/>`);
  }
  const firstBody = band.rows.findIndex(r => !r.header);
  if (band.rowHeader && firstBody >= 0) {
    parts.push(`<path d="M${Math.round(must(band.colX[1]))},${Math.round(must(band.rows[firstBody]).y)} V${Math.round(y1)}" stroke="${PALETTE.text}" stroke-width="3"/>`);
  }
  if (band.rowCurve?.points.length) {
    const c = band.rowCurve;
    parts.push(`<path d="M${snap4(must(band.colX[1]) + 8)},${snap4(c.midY)} H${snap4(band.x + band.w - 8)}" fill="none" stroke="${PALETTE.muted}" stroke-width="1.5" stroke-dasharray="4,4"/>`);
    if (c.points.length > 1) parts.push(`<polyline points="${c.points.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' ')}" fill="none" stroke="${PALETTE[day].accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);
    for (const p of c.points) { const x = snap4(p.x), y = snap4(p.y); parts.push(`<path d="M${x - 4},${y} A4,4 0 1 0 ${x + 4},${y} A4,4 0 1 0 ${x - 4},${y}" fill="${PALETTE.bg}" stroke="${PALETTE[day].accent}" stroke-width="2.5"/>`); }
  }
  for (const row of band.rows) {
    for (const c of row.cells) {
      const withIcon = c.icon !== undefined, indent = withIcon ? TBL.iconSize + TBL.iconGap : 0;
      const left = c.x + 12 + indent, right = c.x + c.w - 12;
      const anchor = c.align === 'center' ? 'middle' : c.align === 'right' ? 'end' : 'start';
      const x = c.align === 'center' ? (left + right) / 2 : c.align === 'right' ? right : left;
      if (c.lines.length) parts.push(textLines(c.lines, {x, top: c.top, size: roles.body, weight: c.bold ? 700 : 400, anchor, fill: resolveTextColor(tones, c.tone, day), mono: c.mono}));
      if (c.icon) {
        // beside left-aligned text: at the cell's left edge; beside centred / right-aligned text: just before its first line; alone: where the text would stand
        const before = (tx: number) => tx - TBL.iconGap - TBL.iconSize;
        const ix = c.align === 'left' ? c.x + 12
          : c.lines.length ? (c.align === 'center' ? before(x - (c.lineW ?? 0) / 2) : before(right - (c.lineW ?? 0)))
          : c.align === 'center' ? c.x + (c.w - TBL.iconSize) / 2 : right - TBL.iconSize;
        const iy = c.top + (lineH(roles.body) - TBL.iconSize) / 2;
        parts.push(iconSvg({glyph: c.icon.glyph, name: c.icon.name, x: ix, y: iy, size: TBL.iconSize, color: resolveTextColor(tones, c.icon.tone ?? c.tone, day), labelled: c.lines.length > 0}));
      }
    }
  }
  const top = band.y, h = band.h;
  parts.push(`<path d="${rrPath(band.x, top, band.w, h, {tl: R, tr: R, bl: R, br: R})}" fill="none" stroke="${PALETTE.text}" stroke-width="2.5"/>`);
  return parts.join('\n  ');
}


// wireframe() / screens(): a flat list of primitives with token-key colours (see wireframe.ts)
