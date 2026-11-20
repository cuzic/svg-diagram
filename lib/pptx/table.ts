import {PALETTE, colorOf, textColorOf, type ToneEnv} from '../tokens.ts';
import type {ChartTable, TableRule} from '../charts-base.ts';
import type {Theme} from '../types/core.ts';
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

/** A side of a chart table's cell: its rule, or none. */
function ruleXml(tag: string, rule: TableRule | undefined, day: Theme): string {
  if (!rule) return `<a:${tag} w="0"><a:noFill/></a:${tag}>`;
  return `<a:${tag} w="${emu(rule.sw)}" cap="flat" cmpd="sng" algn="ctr">${solidFill(colorOf(rule.stroke, day))}<a:prstDash val="${rule.dash ? 'dash' : 'solid'}"/><a:round/><a:headEnd type="none" w="med" len="med"/><a:tailEnd type="none" w="med" len="med"/></a:${tag}>`;
}

/**
 * A chart that is a table (harvey, compare, heatmap: charts-base.ts ChartTable), or a swimlane's frame (./swimlane.ts), as a PowerPoint table: each cell's text, fill and rules as
 * the svg draws them. No table style: every cell says its own fill and sides. What the table does not hold (a Harvey ball, a legend) the
 * caller draws over it.
 */
export function chartTableXml(id: number, name: string, t: ChartTable, day: Theme, fonts: Fonts): string {
  const cols = t.colW.map(w => `<a:gridCol w="${emu(w)}"/>`).join('');
  const rows = t.cells.map((row, i) => {
    const cells = row.map(c => {
      if (c === null) return '<a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP"/></a:p></a:txBody><a:tcPr/></a:tc>';
      const color = hex(colorOf(c.ink, day));
      const size = c.size ?? t.size, pitch = c.pitch ?? t.pitch, lnSpc = `<a:lnSpc><a:spcPts val="${Math.round(pitch * 75)}"/></a:lnSpc>`;
      const runs = c.lines.map((line, k) => `${k ? '<a:br/>' : ''}${runXml(line, size, !!c.bold, false, color, fonts)}`).join('');
      const algn = c.align === 'start' ? 'l' : c.align === 'end' ? 'r' : 'ctr';
      const padX = c.padX ?? 2, padY = c.padY ?? 0;
      // PowerPoint puts a line's baseline 0.8 of its pitch below the line's top: a bottom inset of padY puts the last baseline padY above the bottom
      const marT = c.valign === 'top' ? padY : 0, marB = c.valign === 'bottom' ? Math.max(0, padY - pitch * 0.2) : 0;
      const anchor = c.valign === 'top' ? 't' : c.valign === 'bottom' ? 'b' : 'ctr';
      const fill = !c.fill ? '<a:noFill/>' : c.fill.op === undefined || c.fill.op >= 1 ? solidFill(colorOf(c.fill.key, day))
        : `<a:solidFill><a:srgbClr val="${hex(colorOf(c.fill.key, day))}"><a:alpha val="${Math.round(c.fill.op * 100000)}"/></a:srgbClr></a:solidFill>`;
      const end = runs ? '' : '<a:endParaRPr lang="ja-JP"/>';
      const span = c.span && c.span > 1 ? ` gridSpan="${c.span}"` : '';
      return `<a:tc${span}><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${algn}">${lnSpc}</a:pPr>${runs}${end}</a:p></a:txBody><a:tcPr marL="${emu(c.align === 'start' ? padX : 2)}" marR="${emu(c.align === 'end' ? padX : 2)}" marT="${emu(marT)}" marB="${emu(marB)}" anchor="${anchor}">${ruleXml('lnL', c.l, day)}${ruleXml('lnR', c.r, day)}${ruleXml('lnT', c.t, day)}${ruleXml('lnB', c.b, day)}${fill}</a:tcPr></a:tc>`;
    }).join('');
    return `<a:tr h="${emu(t.rowH[i] ?? 0)}">${cells}</a:tr>`;
  });
  const w = t.colW.reduce((a, b) => a + b, 0), h = t.rowH.reduce((a, b) => a + b, 0);
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${attr(name)}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(t.x)}" y="${emu(t.y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid>${cols}</a:tblGrid>${rows.join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}
