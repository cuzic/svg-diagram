import {PALETTE, textColorOf, type ToneEnv} from '../tokens.ts';
import {resolveBoxStyle} from '../emit-common.ts';
import {LINE_HEIGHT_EM} from '../layout-util.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutTable} from '../types/sequence-table-swimlane.ts';
import {emu, hex, solidFill, attr, type Fonts} from './xml.ts';
import {runXml} from './text.ts';

/** How many grid columns a cell covers: the layout gives x/w only, so match them back against the column grid. */
function spanOf(b: LaidOutTable, c: {x: number; w: number}): number {
  const start = b.colX.findIndex(x => Math.abs(x - c.x) < 1);
  let span = 1, covered = start >= 0 ? (b.colW[start] ?? c.w) : c.w;
  while (start >= 0 && covered + 1 < c.w && start + span < b.colW.length) covered += (b.colW[start + span++] ?? 0);
  return span;
}

/**
 * A table as a PowerPoint table, drawn as the svg draws it (emit-tables.ts renderTable): the title bar in the accent with white text, the
 * header row and a row heading column soft, a row of a tone that tone's fill; thin border-coloured lines inside, a dark frame around and a
 * dark line after the row heading column; each cell's text in its own colour, at the svg's place (the top inset puts the first baseline
 * where the svg has it). Not mapped: the rounded corners (a table's are square) and a cell's icon.
 */
export function tableXml(id: number, b: LaidOutTable, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts): string {
  const day = ld.day, size = ld.roles.body, n = b.colW.length;
  const cols = b.colW.map(w => `<a:gridCol w="${emu(w)}"/>`).join('');
  const ln = (tag: string, color: string, w: number) => `<a:${tag} w="${emu(w)}" cap="flat" cmpd="sng" algn="ctr">${solidFill(color)}<a:prstDash val="solid"/><a:round/><a:headEnd type="none" w="med" len="med"/><a:tailEnd type="none" w="med" len="med"/></a:${tag}>`;
  const OUTER: [string, number] = [PALETTE.text, 2.5], INNER: [string, number] = [PALETTE.border, 2], HEADING: [string, number] = [PALETTE.text, 3];
  const firstBody = b.rows.findIndex(r => !r.header);
  const cell = (lines: readonly string[], o: {col: number; span: number; first: boolean; last: boolean; top: number; rowY: number; fill: string; color: string; bold: boolean; mono: boolean; align: 'l' | 'ctr' | 'r'; size: number; marL: number; body: boolean}): string => {
    const pitch = o.size * LINE_HEIGHT_EM;
    // the svg's first baseline is at top + size; PowerPoint puts it 0.8 of the line pitch below the text area's top
    const marT = Math.max(0, o.top + o.size - pitch * 0.8 - o.rowY);
    const end = o.col + o.span;
    const heading = (edge: 'L' | 'R') => b.rowHeader && o.body && (edge === 'L' ? o.col === 1 : end === 1);
    const left = o.col === 0 ? OUTER : heading('L') ? HEADING : INNER, right = end === n ? OUTER : heading('R') ? HEADING : INNER;
    const top = o.first ? OUTER : INNER, bottom = o.last ? OUTER : INNER;
    const runs = (lines.length ? lines : ['']).map((line, i) => `${i ? '<a:br/>' : ''}${runXml(line, o.size, o.bold, o.mono, hex(o.color), fonts)}`).join('');
    const span = o.span > 1 ? ` gridSpan="${o.span}"` : '';
    const merged = Array.from({length: o.span - 1}, () => '<a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP"/></a:p></a:txBody><a:tcPr/></a:tc>').join('');
    return `<a:tc${span}><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${o.align}"><a:lnSpc><a:spcPts val="${Math.round(pitch * 75)}"/></a:lnSpc></a:pPr>${runs}</a:p></a:txBody><a:tcPr marL="${emu(o.marL)}" marR="${emu(12)}" marT="${emu(marT)}" marB="0">${ln('lnL', ...left)}${ln('lnR', ...right)}${ln('lnT', ...top)}${ln('lnB', ...bottom)}${solidFill(o.fill)}</a:tcPr></a:tc>${merged}`;
  };
  const rows: string[] = [];
  const t = b.titleBar;
  if (t) rows.push(`<a:tr h="${emu(t.h)}">${cell(t.lines, {col: 0, span: n, first: true, last: false, top: t.y + 8, rowY: t.y, fill: PALETTE[day].accent, color: PALETTE.bg, bold: true, mono: false, align: 'l', size: ld.roles.title, marL: 12, body: false})}</a:tr>`);
  b.rows.forEach((row, ri) => {
    const rowFill = row.header ? PALETTE[day].soft : row.tone ? resolveBoxStyle(tones, row.tone, day).fill : PALETTE.bg;
    const cells = row.cells.map(c => {
      const col = Math.max(0, b.colX.findIndex(x => Math.abs(x - c.x) < 1)), span = spanOf(b, c);
      return cell(c.lines, {
        col, span, first: ri === 0 && !t, last: ri === b.rows.length - 1, top: c.top, rowY: row.y,
        fill: b.rowHeader && !row.header && col === 0 ? PALETTE[day].soft : rowFill, color: textColorOf(tones, c.tone, day),
        bold: c.bold, mono: c.mono, align: c.align === 'center' ? 'ctr' : c.align === 'right' ? 'r' : 'l', size, marL: 12, body: ri >= firstBody && firstBody >= 0,
      });
    }).join('');
    rows.push(`<a:tr h="${emu(row.h)}">${cells}</a:tr>`);
  });
  const y = t?.y ?? b.y;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${attr(b.id ?? `table-${id}`)}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(b.x)}" y="${emu(y)}"/><a:ext cx="${emu(b.w)}" cy="${emu(b.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid>${cols}</a:tblGrid>${rows.join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}
