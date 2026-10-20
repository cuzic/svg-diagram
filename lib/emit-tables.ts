import {PALETTE, colorOf, runColorOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {badgeSvg, pillSvg} from './badge.ts';
import type {Theme, ColorKey, Roles} from './types/core.ts';
import type {LaidOutSequence, LaidOutTable} from './types/sequence-table-swimlane.ts';
import type {Prim} from './types/wireframe-nodes.ts';
import type {LaidOutWireframe, LaidOutScreens} from './types/wireframe.ts';
import {TBL, lineH} from './seq-table.ts';
import {iconSvg} from './icon-svg.ts';
import {snap4, escapeXml, emojiSpan, resolveTextColor, resolveLineColor, strokeLine, textLines, rrPath, resolveBoxStyle} from './emit-common.ts';

export function renderSequence(band: LaidOutSequence, day: Theme, tones: ToneEnv, roles: Roles): string {
  const parts: string[] = [];
  for (const h of band.heads) {
    parts.push(`<path d="M${Math.round(h.cx)},${Math.round(h.y + h.h)} L${Math.round(h.cx)},${Math.round(band.lifeBottom)}" fill="none" stroke="${PALETTE.border}" stroke-width="2" stroke-dasharray="6,6"/>`);
  }
  for (const h of band.heads) {
    const st = resolveBoxStyle(tones, h.tone ?? 'plain', day);
    parts.push(`<rect x="${snap4(h.x)}" y="${snap4(h.y)}" width="${snap4(h.w)}" height="${snap4(h.h)}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"${st.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    if (h.icon) parts.push(iconSvg({glyph: h.icon.glyph, name: h.icon.name, x: h.icon.x, y: h.icon.y, size: h.icon.size, color: runColorOf(tones, h.icon.tone, h.tone, day), labelled: true}));
    parts.push(textLines(h.lines, {x: h.cx, top: h.y + h.textDy, size: roles.title, weight: 700, anchor: 'middle', fill: PALETTE.text}));
  }
  for (const s of band.steps) {
    if (s.kind === 'msg') {
      const color = resolveLineColor(tones, s.tone, day);
      parts.push(strokeLine(`M${Math.round(s.x1)},${Math.round(s.y)} L${Math.round(s.x2)},${Math.round(s.y)}`, color, s.line, s.arrow));
      parts.push(textLines(s.lines, {x: s.lx, top: s.labelTop, size: roles.note, anchor: 'middle', fill: s.tone ? color : PALETTE.text}));
    } else if (s.kind === 'self') {
      const color = resolveLineColor(tones, s.tone, day);
      const dir = s.side === 'left' ? -1 : 1;
      const x0 = Math.round(s.cx), x1 = Math.round(s.cx + dir * 36), y0 = Math.round(s.y), y1 = Math.round(s.y + s.loopH);
      parts.push(strokeLine(`M${x0},${y0} L${x1},${y0} L${x1},${y1} L${x0},${y1}`, color, s.line, 'end'));
      parts.push(textLines(s.lines, {x: s.lx, top: s.labelTop, size: roles.note, anchor: s.side === 'left' ? 'end' : undefined, fill: s.tone ? color : PALETTE.text}));
    } else if (s.kind === 'note') {
      const st = resolveBoxStyle(tones, s.tone, day);
      parts.push(`<rect x="${snap4(s.x)}" y="${snap4(s.y)}" width="${snap4(s.w)}" height="${snap4(s.h)}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"${st.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
      parts.push(textLines(s.lines, {x: s.x + 12, top: s.y + 8, size: roles.note, fill: PALETTE.text}));
    } else {
      parts.push(`<path d="M${Math.round(s.x1)},${Math.round(s.y)} L${Math.round(s.x2)},${Math.round(s.y)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="6,4"/>`);
      parts.push(`<rect x="${snap4(s.cx - s.chipW / 2)}" y="${snap4(s.y - 12)}" width="${snap4(s.chipW)}" height="24" rx="12" fill="${PALETTE.bg}" stroke="${PALETTE.muted}" stroke-width="2"/>`);
      parts.push(textLines([s.text], {x: s.cx, top: s.y - 12 + 1, size: roles.note, weight: 700, anchor: 'middle', fill: PALETTE.text}));
    }
  }
  return parts.join('\n  ');
}


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
export type PaintPrim = Exclude<Prim, {k: 'text' | 'badge' | 'pill'}>;

export function renderPrims(b: LaidOutWireframe | LaidOutScreens, day: Theme): string {
  const col = (k: ColorKey | null): string => k == null ? 'none' : colorOf(k, day);
  const stroke = (p: PaintPrim): string => {
    const dash = 'dash' in p ? p.dash : undefined; // circles have no dash
    return p.stroke ? ` stroke="${col(p.stroke)}" stroke-width="${p.sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}` : '';
  };
  const fill = (p: PaintPrim): string => `fill="${col(p.fill)}"${p.op != null && p.fill ? ` fill-opacity="${p.op}"` : ''}`;
  const out: string[] = [];
  for (const p of b.prims) {
    if (p.k === 'rect') {
      const x0 = snap4(p.x), y0 = snap4(p.y), x1 = snap4(p.x + p.w), y1 = snap4(p.y + p.h);
      out.push(`<rect x="${x0}" y="${y0}" width="${Math.max(0, x1 - x0)}" height="${Math.max(0, y1 - y0)}"${p.r ? ` rx="${p.r}"` : ''} ${fill(p)}${stroke(p)}/>`);
    } else if (p.k === 'circle') {
      out.push(`<circle cx="${snap4(p.cx)}" cy="${snap4(p.cy)}" r="${p.r}" ${fill(p)}${stroke(p)}/>`);
    } else if (p.k === 'path') {
      out.push(`<path d="${p.d}" ${fill(p)}${stroke(p)}${p.stroke ? ' stroke-linejoin="round"' : ''}/>`);
    } else if (p.k === 'pill') {
      const x0 = snap4(p.x), y0 = snap4(p.y), x1 = snap4(p.x + p.w), y1 = snap4(p.y + p.h);
      out.push(pillSvg({x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0), fill: col(p.fill), stroke: p.stroke ? col(p.stroke) : null, cx: p.x + p.w / 2, baseline: p.base, text: col(p.text), size: p.size, labelHtml: emojiSpan(p.label)}));
    } else if (p.k === 'badge') {
      out.push(badgeSvg({cx: p.cx, cy: p.cy, r: p.r, w: p.w, shape: p.shape, label: p.label, aria: p.aria, size: p.size, fill: col(p.fill), stroke: PALETTE.bg, sw: 2, snap: snap4, esc: escapeXml}));
    } else if (p.k === 'text') {
      const a = p.anchor === 'middle' ? ' text-anchor="middle"' : p.anchor === 'end' ? ' text-anchor="end"' : '';
      out.push(`<text x="${Math.round(p.x)}" y="${Math.round(p.y)}"${a} font-size="${p.size}" font-weight="${p.weight}" fill="${col(p.fill)}">${emojiSpan(p.s)}</text>`);
    }
  }
  return out.join('\n  ');
}

