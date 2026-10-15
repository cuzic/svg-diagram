import {PALETTE} from '../tokens.ts';
import {LINE_HEIGHT_EM} from '../layout-util.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutTable} from '../types/sequence-table-swimlane.ts';
import {emu, hex, type Fonts, attr} from './xml.ts';
import {runXml} from './text.ts';

const TABLE_STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

/** How many grid columns a cell covers: the layout gives x/w only, so match them back against the column grid. */
function spanOf(b: LaidOutTable, c: {x: number; w: number}): number {
  const start = b.colX.findIndex(x => Math.abs(x - c.x) < 1);
  let span = 1, covered = start >= 0 ? b.colW[start]! : c.w;
  while (start >= 0 && covered + 1 < c.w && start + span < b.colW.length) covered += b.colW[start + span++]!;
  return span;
}

export function tableXml(id: number, b: LaidOutTable, ld: LaidOutDiagram, fonts: Fonts): string {
  const cols = b.colW.map(w => `<a:gridCol w="${emu(w)}"/>`).join('');
  const cell = (text: string, lines: string[], opts: {span?: number; fill: string; bold?: boolean; mono?: boolean; align?: string}): string => {
    const span = opts.span && opts.span > 1 ? ` gridSpan="${opts.span}"` : '';
    const runs = (lines.length ? lines : [text]).map((line, i) => `${i ? '<a:br/>' : ''}${runXml(line, b.bodySize, !!opts.bold, !!opts.mono, hex(PALETTE.text), fonts)}`).join('');
    return `<a:tc${span}><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${opts.align ?? 'l'}"><a:lnSpc><a:spcPts val="${Math.round(b.bodySize * LINE_HEIGHT_EM * 75)}"/></a:lnSpc></a:pPr>${runs}</a:p></a:txBody><a:tcPr marL="${emu(12)}" marR="${emu(12)}" marT="${emu(6)}" marB="${emu(6)}"><a:solidFill><a:srgbClr val="${hex(opts.fill)}"/></a:solidFill></a:tcPr></a:tc>`;
  };
  const rows: string[] = [];
  if (b.titleBar) rows.push(`<a:tr h="${emu(b.titleBar.h)}">${cell(b.titleBar.lines.join('\n'), b.titleBar.lines, {span: b.colW.length, fill: PALETTE[ld.day].accent, bold: true})}</a:tr>`);
  for (const row of b.rows) {
    const cells = row.cells.map((c, i) => cell(c.text, c.lines, {
      span: spanOf(b, c),
      fill: row.header || b.rowHeader && !row.header && i === 0 ? PALETTE[ld.day].soft : PALETTE.bg,
      bold: c.bold || row.header, mono: c.mono, align: c.align === 'center' ? 'ctr' : c.align === 'right' ? 'r' : 'l',
    })).join('');
    rows.push(`<a:tr h="${emu(row.h)}">${cells}</a:tr>`);
  }
  const y = b.titleBar?.y ?? b.y;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${attr(b.id ?? `table-${id}`)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(b.x)}" y="${emu(y)}"/><a:ext cx="${emu(b.w)}" cy="${emu(b.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="0"><a:tableStyleId>${TABLE_STYLE_ID}</a:tableStyleId></a:tblPr><a:tblGrid>${cols}</a:tblGrid>${rows.join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}
