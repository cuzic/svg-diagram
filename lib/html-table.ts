import {resolveBoxStyle} from './box-style.ts';
import {escapeHtmlText as esc, px, type FontBox, type HtmlBandAdapter} from './html-adapter.ts';
import {must} from './must.ts';
import {PALETTE, textColorOf, type ToneEnv} from './tokens.ts';
import type {Align, Roles, Theme} from './types/core.ts';
import type {LaidOutTable} from './types/sequence-table-swimlane.ts';

// One line of text at an absolute spot: `baseline` is where the glyphs sit (as the SVG <text> y would be), relative to the parent.
function lineDiv(o: {fb: FontBox; left: number; baseline: number; width: number; align: Align; size: number; weight: number; mono: boolean; color: string; html: string}): string {
  const {ascent, descent} = o.fb(o.size, o.weight, o.mono);
  return `<div class="sd-t${o.mono ? ' sd-m' : ''}" style="left:${px(o.left)};top:${px(o.baseline - ascent)};width:${px(o.width)};text-align:${o.align};font-size:${o.size}px;font-weight:${o.weight};line-height:${ascent + descent}px;color:${o.color}">${o.html}</div>`;
}

// A real <table> (header cells are <th>, so assistive technology reads rows and columns) with fixed column widths and row heights;
// the text of a cell is pre-broken lines placed over its box. Rounded corners come from a clipping wrapper, the outline from an overlay.
function table(b: LaidOutTable, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles): string {
  const out = tablePlain(b, day, tones, fb, roles);
  // outside the spotlight: what emit.ts does to the SVG of a table: every colour but the page's becomes muted
  return b.dim ? out.replace(/#[0-9a-fA-F]{6}/g, c => c.toLowerCase() === PALETTE.bg.toLowerCase() ? c : PALETTE.muted) : out;
}

function tablePlain(b: LaidOutTable, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles): string {
  const R = 8, LH = 1.4;
  const first = must(b.rows[0]);
  const y0 = first.y, y1 = must(b.rows[b.rows.length - 1]).y + must(b.rows[b.rows.length - 1]).h;
  const firstBody = b.rows.findIndex(r => !r.header);
  const rule = `2px solid ${PALETTE.border}`;
  const cols = b.colW.map(w => `<col style="width:${px(w)}">`).join('');
  const rows = b.rows.map((row, i) => {
    const bg = row.header ? PALETTE[day].soft : row.tone ? resolveBoxStyle(tones, row.tone, day).fill : PALETTE.bg;
    const cells = row.cells.map((c, j) => {
      const tag = row.header ? 'th' : b.rowHeader && j === 0 ? 'th' : 'td';
      const scope = tag === 'th' ? ` scope="${row.header ? 'col' : 'row'}"` : '';
      const heading = b.rowHeader && !row.header && j === 0;
      const left = c.align === 'center' ? 0 : c.align === 'right' ? 0 : 12;
      const right = c.align === 'right' ? 12 : 0;
      // a collapsed border takes half its width out of the cell on each side it has: shift the text back by that much
      const edge = j === 1 && b.rowHeader && i >= firstBody && firstBody >= 0 ? 3 : j > 0 ? 2 : 0;
      const topRule = i > 0 || b.titleBar ? 2 : 0;
      const lines = c.lines.map((l, k) => lineDiv({fb, left: left - edge / 2, baseline: c.top - row.y - topRule / 2 + b.bodySize + k * b.bodySize * LH, width: c.w - left - right, align: c.align, size: b.bodySize, weight: c.bold ? 700 : 400, mono: c.mono, color: textColorOf(tones, c.tone, day), html: esc(l)})).join('');
      const style = heading ? `background:${PALETTE[day].soft};` : '';
      const borderL = edge === 3 ? `border-left:3px solid ${PALETTE.text};` : edge ? `border-left:${rule};` : '';
      return `<${tag}${scope} style="${style}${borderL}">${lines}</${tag}>`;
    }).join('');
    return `<tr style="height:${px(row.h)};background:${bg};${i > 0 || b.titleBar ? `border-top:${rule};` : ''}">${cells}</tr>`;
  }).join('');
  const title = b.titleBar
    ? `<div class="sd-tb" style="left:${px(b.x)};top:${px(b.titleBar.y)};width:${px(b.w)};height:${px(b.titleBar.h)};background:${PALETTE[day].accent}">${b.titleBar.lines.map((l, k) => lineDiv({fb, left: 12, baseline: 8 + roles.title + k * roles.title * LH, width: b.w - 24, align: 'left', size: roles.title, weight: 700, mono: false, color: PALETTE.bg, html: esc(l)})).join('')}</div>`
    : '';
    return `<div class="sd-tbl" style="left:${px(b.x)};top:${px(y0)};width:${px(b.w)};height:${px(y1 - y0)}${b.titleBar ? ';border-radius:0 0 8px 8px' : ''}"><table style="width:${px(b.w)}"><colgroup>${cols}</colgroup><tbody>${rows}</tbody></table></div>${title}<div class="sd-b" style="left:${px(b.x - 1.25)};top:${px(b.y - 1.25)};width:${px(b.w + 2.5)};height:${px(b.h + 2.5)};box-shadow:inset 0 0 0 2.5px ${PALETTE.text};border-radius:${R + 1.25}px"></div>`;
}

export const tableHtml: HtmlBandAdapter<'table'> = {type: 'table', accepts: () => true, render: table};
