import fs from 'node:fs';
import {Resvg} from '@resvg/resvg-js';
import {resolveBoxStyle, escapeXml} from '../emit-common.ts';
import {emitSvg} from '../emit.ts';
import {runColorOf, textColorOf, PALETTE} from '../tokens.ts';
import {prefixSvgIds} from '../svg-ids.ts';
import {currentFontSpecs} from '../measure.ts';
import type {LaidOutDiagram, LaidOutBand} from '../types/index.ts';
import type {LaidOutBox} from '../types/text-bands.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import type {LaidOutTable} from '../types/sequence-table-swimlane.ts';
import {zipStore} from './zip.ts';
import {BOX_PAD_X, BOX_PAD_Y, LINE_HEIGHT_EM} from '../layout-util.ts';
import {fitConnector, evalConnector, maxDeviation, EMU, type Pt} from './geom.ts';
import {PPTX_CHART_HANDLERS, PPTX_HANDLERS, type PptxMode} from './handlers.ts';

// The font measured by the project and written here must match (ADR 0027); BIZ UDPGothic is the PPTX default.
const DEFAULT_FONT = 'BIZ UDPGothic';
const DEFAULT_MONO_FONT = 'BIZ UDGothic';
const emu = (px: number): number => Math.round(px * EMU);
const hex = (c: string): string => c.replace('#', '').toUpperCase();

export interface Report {
  name: string;
  bandTypes: Record<string, number>;
  nativeShapes: number;
  unhandledBands: Record<string, number>;
  connects: number;
  glued: number; // both ends glued
  halfGlued: number;
  unglued: number;
  fitFailed: {why: string; n: number}[];
  worstDeviationPx: number;
  offCentreEnds: number;
  glueEnds: number;
  dupIds: number;
  segHist: Record<number, number>;
  labels?: number;
}

export interface PptxOptions {font?: string; monoFont?: string; pngScale?: number; name?: string}
interface Built {xml: string; widthEmu: number; heightEmu: number; report: Report; extra: Extra}

type Site = {idx: number; dist: number};
const SIDE_IDX: Record<string, number> = {top: 0, left: 1, bottom: 2, right: 3};
function siteOf(box: {x: number; y: number; w: number; h: number}, p: Pt, label: string): Site {
  const side = /^[^:]+:(top|left|bottom|right)/.exec(label)?.[1];
  const cand = [{idx: 0, x: box.x + box.w / 2, y: box.y}, {idx: 1, x: box.x, y: box.y + box.h / 2}, {idx: 2, x: box.x + box.w / 2, y: box.y + box.h}, {idx: 3, x: box.x + box.w, y: box.y + box.h / 2}];
  const all = cand.map(c => ({idx: c.idx, dist: Math.hypot(c.x - p.x, c.y - p.y)}));
  return (side !== undefined ? all.find(c => c.idx === SIDE_IDX[side]) : undefined) ?? all.sort((a, b) => a.dist - b.dist)[0]!;
}

function runXml(text: string, size: number, bold: boolean, mono: boolean, color: string, fonts: {sans: string; mono: string}): string {
  const face = mono ? fonts.mono : fonts.sans;
  const rpr = `<a:rPr lang="ja-JP" sz="${Math.round(size * 75)}" b="${bold ? 1 : 0}" kern="0" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${face}"/><a:ea typeface="${face}"/></a:rPr>`;
  return `<a:r>${rpr}<a:t>${escapeXml(text)}</a:t></a:r>`;
}

function paragraphsOf(runs: LaidOutBox['wrappedRuns'], boxTone: string | undefined, day: LaidOutDiagram['day'], align: string, fonts: {sans: string; mono: string}): string {
  return runs.map((r, i) => {
    const pitch = r.lines.length > 1 ? r.lineYs[1]! - r.lineYs[0]! : Math.round(r.size * LINE_HEIGHT_EM);
    const prev = i > 0 ? runs[i - 1]! : undefined;
    const before = prev ? Math.max(0, r.lineYs[0]! - prev.lineYs[prev.lineYs.length - 1]! - pitch) : 0;
    const base = hex(runColorOf(r.tone, boxTone, day));
    const lines = r.lines.map((ln, k) => {
      const spans = r.lineSpans?.[k];
      const body = spans ? spans.map(sp => runXml(sp.text, r.size, sp.bold === true || r.weight === 700, r.mono, sp.tone ? hex(textColorOf(sp.tone, day)) : base, fonts)).join('') : runXml(ln, r.size, r.weight === 700, r.mono, base, fonts);
      return (k ? `<a:br><a:rPr lang="ja-JP" sz="${Math.round(r.size * 75)}"/></a:br>` : '') + body;
    }).join('');
    // `indent` (room for a step badge / icon) narrows and shifts the whole run: every line of it (lib/emit-common.ts renderTextRuns)
    const ind = r.indent ? ` marL="${emu(r.indent)}"` : '';
    return `<a:p><a:pPr algn="${align}"${ind}><a:lnSpc><a:spcPts val="${Math.round(pitch * 75)}"/></a:lnSpc><a:spcBef><a:spcPts val="${Math.round(before * 75)}"/></a:spcBef></a:pPr>${lines}</a:p>`;
  }).join('');
}

function boxXml(id: number, name: string, b: LaidOutBox, day: LaidOutDiagram['day'], opts: {frame?: boolean; padX?: number; padY?: number; defaultAlign?: 'left' | 'center' | 'right'; noWrap?: boolean; fonts: {sans: string; mono: string}}): string {
  const style = resolveBoxStyle(b.tone, day, b.dashed);
  const px = opts.padX ?? b.padX ?? BOX_PAD_X, py = opts.padY ?? b.padY ?? BOX_PAD_Y;
  const frame = opts.frame ?? b.frame !== false;
  const rx = Math.min(b.w, b.h) > 0 ? Math.round((8 / Math.min(b.w, b.h)) * 100000) : 0;
  const al = b.align ?? opts.defaultAlign ?? 'left';
  const align = al === 'center' ? 'ctr' : al === 'right' ? 'r' : 'l';
  const paras = paragraphsOf(b.wrappedRuns, b.tone, day, align, opts.fonts);
  // the first baseline is lineYs[0] below the content top (the svg puts text at band.y + padY + lineYs[i]); with exact line spacing the
  // baseline sits ~0.8 of the pitch below the line's top -- that factor is what S2 measures on a real PowerPoint
  const first = b.wrappedRuns[0];
  const firstPitch = first ? (first.lines.length > 1 ? first.lineYs[1]! - first.lineYs[0]! : Math.round(first.size * LINE_HEIGHT_EM)) : 0;
  const topInset = first ? Math.max(0, py + first.lineYs[0]! - firstPitch * 0.8) : py;
  const dash = style.dashed ? '<a:prstDash val="dash"/>' : '';
  const fill = frame ? `<a:solidFill><a:srgbClr val="${hex(style.fill)}"/></a:solidFill><a:ln w="${emu(2.5)}"><a:solidFill><a:srgbClr val="${hex(style.stroke)}"/></a:solidFill>${dash}</a:ln>` : '<a:noFill/><a:ln><a:noFill/></a:ln>';
  // the text area is wider than the layout's wrap width by 2px on the right (a rounding difference must not push a word to the next line)
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(b.x)}" y="${emu(b.y)}"/><a:ext cx="${emu(b.w)}" cy="${emu(b.h)}"/></a:xfrm><a:prstGeom prst="${frame ? 'roundRect' : 'rect'}"><a:avLst>${frame ? `<a:gd name="adj" fmla="val ${rx}"/>` : ''}</a:avLst></a:prstGeom>${fill}</p:spPr><p:txBody><a:bodyPr wrap="${opts.noWrap ? 'none' : 'square'}" lIns="${emu(px)}" tIns="${emu(topInset)}" rIns="${emu(Math.max(0, px - 2))}" bIns="${emu(py)}" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras || '<a:p><a:endParaRPr lang="ja-JP"/></a:p>'}</p:txBody></p:sp>`;
}

function tableXml(id: number, b: LaidOutTable, ld: LaidOutDiagram, fonts: {sans: string; mono: string}): string {
  const cols = b.colW.map(w => `<a:gridCol w="${emu(w)}"/>`).join('');
  const cell = (text: string, lines: string[], opts: {span?: number; fill: string; bold?: boolean; mono?: boolean; align?: string}): string => {
    const span = opts.span && opts.span > 1 ? ` gridSpan="${opts.span}"` : '';
    const runs = (lines.length ? lines : [text]).map((line, i) => `${i ? '<a:br/>' : ''}${runXml(line, b.bodySize, !!opts.bold, !!opts.mono, hex(PALETTE.text), fonts)}`).join('');
    return `<a:tc${span}><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${opts.align ?? 'l'}"><a:lnSpc><a:spcPts val="${Math.round(b.bodySize * LINE_HEIGHT_EM * 75)}"/></a:lnSpc></a:pPr>${runs}</a:p></a:txBody><a:tcPr marL="${emu(12)}" marR="${emu(12)}" marT="${emu(6)}" marB="${emu(6)}"><a:solidFill><a:srgbClr val="${hex(opts.fill)}"/></a:solidFill></a:tcPr></a:tc>`;
  };
  const rows: string[] = [];
  if (b.titleBar) rows.push(`<a:tr h="${emu(b.titleBar.h)}">${cell(b.titleBar.lines.join('\n'), b.titleBar.lines, {span: b.colW.length, fill: PALETTE[ld.day].accent, bold: true})}</a:tr>`);
  for (const row of b.rows) {
    const cells = row.cells.map((c, i) => {
      const start = b.colX.findIndex(x => Math.abs(x - c.x) < 1);
      let span = 1, covered = start >= 0 ? b.colW[start]! : c.w;
      while (start >= 0 && covered + 1 < c.w && start + span < b.colW.length) covered += b.colW[start + span++]!;
      return cell(c.text, c.lines, {span, fill: row.header || b.rowHeader && !row.header && i === 0 ? PALETTE[ld.day].soft : PALETTE.bg, bold: c.bold || row.header, mono: c.mono, align: c.align === 'center' ? 'ctr' : c.align === 'right' ? 'r' : 'l'});
    }).join('');
    rows.push(`<a:tr h="${emu(row.h)}">${cells}</a:tr>`);
  }
  const y = b.titleBar?.y ?? b.y;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${escapeXml(b.id ?? `table-${id}`)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(b.x)}" y="${emu(y)}"/><a:ext cx="${emu(b.w)}" cy="${emu(b.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="0"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid>${cols}</a:tblGrid>${rows.join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function resvgMarkers(svg: string): string {
  const copies: string[] = [];
  let out = svg.replace(/<marker\b([^>]*\bid="([^"]+)"[^>]*)orient="auto-start-reverse"([^>]*)>([\s\S]*?)<\/marker>/g, (_m, a: string, id: string, z: string, body: string) => {
    copies.push(`<marker${a.replace(`id="${id}"`, `id="${id}-start"`)}orient="auto"${z}><g transform="rotate(180 5 5)">${body}</g></marker>`);
    return `<marker${a}orient="auto"${z}>${body}</marker>`;
  });
  if (copies.length) out = out.replace('</defs>', copies.join('') + '</defs>').replace(/marker-start="url\(#([^)]+)\)"/g, 'marker-start="url(#$1-start)"');
  return out;
}

function bandSvg(ld: LaidOutDiagram, band: LaidOutBand, index: number): {svg: string; pngSvg: string; x: number; y: number; w: number; h: number} {
  const pad = 12;
  const h = 'h' in band ? band.h : Math.max(...band.children.map(c => c.y + c.h)) - band.y;
  const x = Math.max(0, band.x - pad), y = Math.max(0, band.y - pad);
  const w = Math.min(ld.width, band.x + band.w + pad) - x, bh = Math.min(ld.canvasHeight, band.y + h + pad) - y;
  let svg = emitSvg({...ld, transparent: true, laidOut: [band], connects: []}, {noRecolor: false});
  svg = svg.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/, `width="${w}" height="${bh}" viewBox="${x} ${y} ${w} ${bh}"`);
  svg = prefixSvgIds(svg, `pptx-band-${index}`);
  return {svg, pngSvg: resvgMarkers(svg), x, y, w, h: bh};
}

function freeformXml(id: number, c: LaidOutConnect, day: LaidOutDiagram['day']): string {
  const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
  const path = c.points.map((p, i) => i === 0 ? `<a:moveTo><a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/></a:moveTo>` : `<a:lnTo><a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/></a:lnTo>`).join('');
  const color = hex(textColorOf(c.tone, day));
  const head = c.arrow === 'start' || c.arrow === 'both' ? '<a:headEnd type="triangle"/>' : '';
  const tail = c.arrow === 'end' || c.arrow === 'both' ? '<a:tailEnd type="triangle"/>' : '';
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="freeform-${escapeXml(c.fromId)}-${escapeXml(c.toId)}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom><a:ln w="${emu(c.weight === 'strong' ? 5 : 2)}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${head}${tail}</a:ln></p:spPr></p:cxnSp>`;
}

export function buildSlide(ld: LaidOutDiagram, name: string, opts: PptxOptions = {}): Built {
  const day = ld.day;
  const fonts = {sans: opts.font ?? DEFAULT_FONT, mono: opts.monoFont ?? opts.font ?? DEFAULT_MONO_FONT};
  const rep: Report = {name, bandTypes: {}, nativeShapes: 0, unhandledBands: {}, connects: 0, glued: 0, halfGlued: 0, unglued: 0, fitFailed: [], worstDeviationPx: 0, offCentreEnds: 0, glueEnds: 0, dupIds: 0, segHist: {}};
  let nextId = 2;
  const idOf = new Map<string, number>(); // DSL id -> shape id
  const rectOf = new Map<string, {x: number; y: number; w: number; h: number}>();
  const parts: string[] = [];
  const media: Record<string, Buffer> = {};
  const rels: string[] = [];
  let imageNo = 0;
  const measuredFonts = [...new Set(Object.values(currentFontSpecs() ?? {}).flatMap(f => [f?.regular, f?.bold]).filter((f): f is string => !!f).map(f => f.replace(/#\d+$/, '')))];
  const bump = (m: Record<string, number>, k: string): void => { m[k] = (m[k] ?? 0) + 1; };
  const addBox = (b: LaidOutBox): string => {
    const id = nextId++;
    if (b.id) { idOf.set(b.id, id); rectOf.set(b.id, b); }
    rep.nativeShapes++;
    const main = boxXml(id, b.id ?? `box-${id}`, b, day, {fonts});
    if (!b.tag && !b.stamp && b.step === undefined && !b.icon) return main;
    const component = (text: string, r: {x: number; y: number; w: number; h: number}, name: string, frame = true): string => {
      const size = Math.min(12, Math.max(8, r.h * 0.48));
      const fake = {...r, tone: b.tone, align: 'center', wrappedRuns: [{text, size, weight: 700, mono: false, lines: [text], lineYs: [size]}]} as unknown as LaidOutBox;
      return boxXml(nextId++, name, fake, day, {frame, padX: 2, padY: 1, defaultAlign: 'center', noWrap: true, fonts});
    };
    const extra: string[] = [];
    if (b.tag && b.tagBox) extra.push(component(b.tag, b.tagBox, `tag-${id}`));
    if (b.stamp) extra.push(component(b.stamp, {x: b.x + b.w - (b.stampW ?? 64) - 8, y: b.y + b.h - 22, w: b.stampW ?? 64, h: 18}, `stamp-${id}`));
    // the icon glyph is not drawn yet (ADR 0027 follow-up): an empty frame in its place would read as a real shape
    if (b.step !== undefined) extra.push(component(String(b.step), {x: b.x + 8 + (b.icon ? 34 : 0), y: b.y + 8, w: 24, h: 24}, `step-${id}`));
    const minY = Math.min(b.y, b.tagBox?.y ?? b.y), maxY = Math.max(b.y + b.h, (b.tagBox?.y ?? b.y) + (b.tagBox?.h ?? 0));
    return group(nextId++, `box-parts-${b.id ?? id}`, {x: b.x, y: minY, w: b.w, h: maxY - minY}, main + extra.join(''));
  };
  const group = (id: number, name: string, r: {x: number; y: number; w: number; h: number}, inner: string): string =>
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${emu(r.x)}" y="${emu(r.y)}"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/><a:chOff x="${emu(r.x)}" y="${emu(r.y)}"/><a:chExt cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm></p:grpSpPr>${inner}</p:grpSp>`;
  const bandsToDo: LaidOutBand[] = ld.laidOut;
  for (const [bandIndex, band] of bandsToDo.entries()) {
    bump(rep.bandTypes, band.type);
    switch (band.type) {
      case 'box': case 'banner': parts.push(addBox(band as unknown as LaidOutBox)); break;
      case 'caption': { // text only: no frame, no padding (the svg writes it at band.x / band.y)
        const id = nextId++;
        rep.nativeShapes++;
        parts.push(boxXml(id, `caption-${id}`, band as unknown as LaidOutBox, day, {frame: false, padX: 0, padY: 0, defaultAlign: 'center', fonts}));
        delete rep.unhandledBands.caption;
        break;
      }
      case 'row': case 'grid': {
        const gid = nextId++;
        const inner = band.children.map(addBox).join('');
        const r = band.type === 'row' ? band : {x: band.x, y: Math.min(...band.children.map(c => c.y)), w: band.w, h: Math.max(...band.children.map(c => c.y + c.h)) - Math.min(...band.children.map(c => c.y))};
        parts.push(group(gid, `${band.type}${'id' in band && band.id ? '-' + band.id : ''}`, r, inner));
        if (band.type === 'row') for (const [arrowIndex, a] of band.arrows.entries()) {
          const nearest = (x: number, y: number) => band.children.map(c => ({c, d: Math.min(Math.abs(x - c.x), Math.abs(x - c.x - c.w), Math.abs(y - c.y), Math.abs(y - c.y - c.h))})).sort((u, v) => u.d - v.d)[0];
          const from = nearest(a.x1, a.y1), to = nearest(a.x2, a.y2), fid = from?.c.id ? idOf.get(from.c.id) : undefined, tid = to?.c.id ? idOf.get(to.c.id) : undefined;
          const fit = fitConnector([{x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}]);
          if (!fit.ok) continue;
          const x = fit.x, fs = fid !== undefined && from && from.d <= 2 ? siteOf(from.c, {x: a.x1, y: a.y1}, '') : undefined, ts = tid !== undefined && to && to.d <= 2 ? siteOf(to.c, {x: a.x2, y: a.y2}, '') : undefined;
          parts.push(`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${nextId++}" name="row-arrow-${arrowIndex}"/><p:cNvCxnSpPr>${fs ? `<a:stCxn id="${fid}" idx="${fs.idx}"/>` : ''}${ts ? `<a:endCxn id="${tid}" idx="${ts.idx}"/>` : ''}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2)}"><a:solidFill><a:srgbClr val="${hex(PALETTE.text)}"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`);
        }
        break;
      }
      case 'group': {
        const id = nextId++;
        if (band.id) { idOf.set(band.id, id); rectOf.set(band.id, band); }
        rep.nativeShapes++;
        const style = resolveBoxStyle(band.tone, day, band.dashed);
        parts.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(band.id ?? 'group-' + id)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(band.x)}" y="${emu(band.y)}"/><a:ext cx="${emu(band.w)}" cy="${emu(band.h)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round((8 / Math.min(band.w, band.h)) * 100000)}"/></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="${hex(style.fill)}"/></a:solidFill><a:ln w="${emu(2.5)}"><a:solidFill><a:srgbClr val="${hex(style.stroke)}"/></a:solidFill>${style.dashed ? '<a:prstDash val="dash"/>' : ''}</a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP"/></a:p></p:txBody></p:sp>`);
        break;
      }
      case 'table': {
        const id = nextId++;
        if (band.id) { idOf.set(band.id, id); rectOf.set(band.id, band); }
        parts.push(tableXml(id, band, ld, fonts));
        rep.nativeShapes++;
        break;
      }
      default: {
        const mode: PptxMode = band.type === 'chart' ? PPTX_CHART_HANDLERS[band.kind] : PPTX_HANDLERS[band.type].mode;
        if (mode !== 'image') throw new Error(`native PPTX handler missing for ${band.type}`);
        bump(rep.unhandledBands, band.type === 'chart' ? `chart:${band.kind}` : band.type);
        const image = bandSvg(ld, band, bandIndex);
        const n = ++imageNo, pngRid = `rId${10 + n * 2}`, svgRid = `rId${11 + n * 2}`;
        media[`ppt/media/image${n}.png`] = Buffer.from(new Resvg(image.pngSvg, {font: measuredFonts.length ? {loadSystemFonts: false, fontFiles: measuredFonts} : {loadSystemFonts: true}, fitTo: {mode: 'zoom', value: opts.pngScale ?? 2}}).render().asPng());
        media[`ppt/media/image${n}.svg`] = Buffer.from(image.svg);
        rels.push(`<Relationship Id="${pngRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${n}.png"/><Relationship Id="${svgRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${n}.svg"/>`);
        const picId = nextId++;
        parts.push(`<p:pic><p:nvPicPr><p:cNvPr id="${picId}" name="${escapeXml(`${band.type}-${bandIndex}`)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${pngRid}"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svgRid}"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(image.x)}" y="${emu(image.y)}"/><a:ext cx="${emu(image.w)}" cy="${emu(image.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
        if ('id' in band && band.id) {
          const anchorId = nextId++;
          idOf.set(band.id, anchorId); rectOf.set(band.id, {x: band.x, y: band.y, w: band.w, h: 'h' in band ? band.h : image.h});
          parts.push(`<p:sp><p:nvSpPr><p:cNvPr id="${anchorId}" name="anchor-${escapeXml(band.id)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(band.x)}" y="${emu(band.y)}"/><a:ext cx="${emu(band.w)}" cy="${emu('h' in band ? band.h : image.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`);
        }
      }
    }
  }
  // connectors (after the shapes, so they sit on top as in the svg)
  for (const c of ld.connects as LaidOutConnect[]) {
    rep.connects++;
    if (c.annot) { rep.unglued++; parts.push(freeformXml(nextId++, c, day)); continue; }
    const fit = fitConnector(c.points);
    if (!fit.ok) { rep.fitFailed.push({why: fit.why, n: 1}); rep.unglued++; parts.push(freeformXml(nextId++, c, day)); continue; }
    const x = fit.x;
    bump(rep.segHist as unknown as Record<string, number>, String(x.prst));
    rep.worstDeviationPx = Math.max(rep.worstDeviationPx, maxDeviation(c.points, evalConnector(x)));
    const from = idOf.get(c.fromId), to = idOf.get(c.toId);
    const fr = rectOf.get(c.fromId), tr = rectOf.get(c.toId);
    const sFrom = from !== undefined && fr ? siteOf(fr, c.points[0]!, c.fromLabel) : undefined;
    const sTo = to !== undefined && tr ? siteOf(tr, c.points[c.points.length - 1]!, c.toLabel) : undefined;
    for (const s of [sFrom, sTo]) if (s) { rep.glueEnds++; if (s.dist > 1) rep.offCentreEnds++; }
    if (sFrom && sTo) rep.glued++; else if (sFrom || sTo) rep.halfGlued++; else rep.unglued++;
    const id = nextId++;
    const color = hex(textColorOf(c.tone, day));
    const strong = c.weight === 'strong';
    const w = emu(strong ? 5 : 2);
    const dash = c.line === 'dashed' ? '<a:prstDash val="dash"/>' : c.line === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
    const cmpd = c.line === 'double' ? ' cmpd="dbl"' : '';
    const head = c.arrow === 'end' || c.arrow === 'both' ? '<a:tailEnd type="triangle" w="med" len="med"/>' : '';
    const tail = c.arrow === 'start' || c.arrow === 'both' ? '<a:headEnd type="triangle" w="med" len="med"/>' : '';
    const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
    parts.push(`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="connect-${escapeXml(c.fromId)}-${escapeXml(c.toId)}"/><p:cNvCxnSpPr>${sFrom ? `<a:stCxn id="${from}" idx="${sFrom.idx}"/>` : ''}${sTo ? `<a:endCxn id="${to}" idx="${sTo.idx}"/>` : ''}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${x.rot ? ` rot="${x.rot}"` : ''}${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm><a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${w}"${cmpd}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${dash}${tail}${head}</a:ln></p:spPr></p:cxnSp>`);
  }
  // connector labels: a text box of their own (a cxnSp cannot hold text), so they stay where they were when a box moves -- ADR 0027 known limit
  for (const c of ld.connects as LaidOutConnect[]) {
    if (!c.label) continue;
    const r = c.labelBox ?? (c.labelX !== undefined && c.labelY !== undefined ? {x: c.labelX - 60, y: c.labelY - 12, w: 120, h: 24} : undefined);
    if (!r) continue;
    const id = nextId++;
    const size = ld.roles.label ?? 14;
    const fake = {...r, wrappedRuns: [{text: c.label, size, weight: 400, mono: false, lines: [c.label], lineYs: [Math.round(size * 1.0)]}], align: 'center', tone: undefined} as unknown as LaidOutBox;
    parts.push(boxXml(id, `label-${escapeXml(c.fromId)}-${escapeXml(c.toId)}`, fake, day, {frame: false, padX: 0, padY: 0, defaultAlign: 'center', noWrap: true, fonts}));
    rep.labels = (rep.labels ?? 0) + 1;
  }
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${parts.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]);
  rep.dupIds = ids.length - new Set(ids).size;
  return {xml, widthEmu: emu(Math.max(96, ld.width)), heightEmu: emu(Math.max(96, ld.canvasHeight)), report: rep, extra: {files: media, slideRels: rels.join(''), defaults: imageNo ? [{ext: 'png', type: 'image/png'}, {ext: 'svg', type: 'image/svg+xml'}] : []}};
}

const TEMPLATE = new URL('./template/', import.meta.url);

function templateFiles(dir = TEMPLATE, prefix = ''): {name: string; data: Buffer}[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? templateFiles(new URL(e.name + '/', dir), prefix + e.name + '/') : [{name: prefix + e.name, data: fs.readFileSync(new URL(e.name, dir))}]);
}

export interface Extra {files: Record<string, Buffer>; slideRels: string; defaults: {ext: string; type: string}[]}

/** One slide on the fixed package template; only the slide, its relationships, size and content types change. */
export function packPptx(slideXml: string, widthEmu: number, heightEmu: number, extra?: Extra): Buffer {
  const entries = templateFiles().map(({name, data}) => {
    let d = data;
    if (name === 'ppt/presentation.xml') d = Buffer.from(data.toString().replace(/<p:sldSz[^>]*\/>/, `<p:sldSz cx="${widthEmu}" cy="${heightEmu}"/>`));
    else if (name === 'ppt/slides/_rels/slide1.xml.rels' && extra) d = Buffer.from(data.toString().replace('</Relationships>', extra.slideRels + '</Relationships>'));
    else if (name === '[Content_Types].xml' && extra) d = Buffer.from(data.toString().replace(/<Types[^>]*>/, m => m + extra.defaults.filter(x => !data.toString().includes(`Extension="${x.ext}"`)).map(x => `<Default Extension="${x.ext}" ContentType="${x.type}"/>`).join('')));
    return {name, data: d};
  });
  entries.push({name: 'ppt/slides/slide1.xml', data: Buffer.from(slideXml)});
  for (const [name, data] of Object.entries(extra?.files ?? {})) entries.push({name, data});
  // [Content_Types].xml first (the convention), then sorted by name
  entries.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return zipStore(entries);
}

/** Serialize one laid-out diagram to a deterministic, single-slide PowerPoint package. Reads only the bundled template; writes nothing. */
export function emitPptx(laidOut: LaidOutDiagram, opts: PptxOptions = {}): Buffer {
  if (!(Number.isFinite(opts.pngScale ?? 2) && (opts.pngScale ?? 2) > 0)) throw new Error(`pngScale must be a positive number (got ${String(opts.pngScale)})`);
  const built = buildSlide(laidOut, opts.name ?? 'diagram', opts);
  return packPptx(built.xml, built.widthEmu, built.heightEmu, built.extra);
}

export function pptxReport(laidOut: LaidOutDiagram, opts: PptxOptions = {}): Report {
  return buildSlide(laidOut, opts.name ?? 'diagram', opts).report;
}
