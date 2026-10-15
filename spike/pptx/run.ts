// Spike: examples/<name>.ts -> LaidOutDiagram -> .pptx (own spTree: boxes with their text inside, glued connectors, groups),
// then judged: connector geometry re-evaluated from the XML, id uniqueness, determinism, LibreOffice render.
// usage: node spike/pptx/run.ts examples/arrow-weight.ts out.pptx
import path from 'node:path';
import fs from 'node:fs';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {loadConfig} from '../../lib/config.ts';
import {loadDiagram} from '../../lib/load-source.ts';
import {renderDiagram} from '../../lib/dsl/render.ts';
import {closeMeasurer} from '../../lib/measure.ts';
import {resolveBoxStyle, escapeXml} from '../../lib/emit-common.ts';
import {runColorOf, textColorOf} from '../../lib/tokens.ts';
import type {LaidOutDiagram, LaidOutBand} from '../../lib/types/index.ts';
import type {LaidOutBox} from '../../lib/types/text-bands.ts';
import type {LaidOutConnect} from '../../lib/types/containers.ts';
import {zipStore} from './zip.ts';
import {BOX_PAD_X, BOX_PAD_Y, LINE_HEIGHT_EM} from '../../lib/layout-util.ts';
import {fitConnector, evalConnector, maxDeviation, EMU, type Pt} from './geom.ts';

// the font the text is measured with AND written with (ADR 0025: one font on both sides); BIZ UDPGothic ships with Windows 10 1809+
const USE_BIZ = process.env.SPIKE_FONT !== 'noto';
const FONT = USE_BIZ ? 'BIZ UDPGothic' : 'Noto Sans JP';
const FONT_MONO = USE_BIZ ? 'BIZ UDGothic' : 'Noto Sans JP';
const BIZ_FILES = {sans: {regular: '/home/cuzic/.local/share/fonts/BIZ-UDGothicR.ttc#1', bold: '/home/cuzic/.local/share/fonts/BIZ-UDGothicB.ttc#1'}};
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

interface Built {xml: string; widthEmu: number; heightEmu: number; report: Report}

type Site = {idx: number; dist: number};
const SIDE_IDX: Record<string, number> = {top: 0, left: 1, bottom: 2, right: 3};
function siteOf(box: {x: number; y: number; w: number; h: number}, p: Pt, label: string): Site {
  const side = /^[^:]+:(top|left|bottom|right)/.exec(label)?.[1];
  const cand = [{idx: 0, x: box.x + box.w / 2, y: box.y}, {idx: 1, x: box.x, y: box.y + box.h / 2}, {idx: 2, x: box.x + box.w / 2, y: box.y + box.h}, {idx: 3, x: box.x + box.w, y: box.y + box.h / 2}];
  const all = cand.map(c => ({idx: c.idx, dist: Math.hypot(c.x - p.x, c.y - p.y)}));
  return (side !== undefined ? all.find(c => c.idx === SIDE_IDX[side]) : undefined) ?? all.sort((a, b) => a.dist - b.dist)[0]!;
}

function runXml(text: string, size: number, bold: boolean, mono: boolean, color: string): string {
  const face = mono ? FONT_MONO : FONT;
  const rpr = `<a:rPr lang="ja-JP" sz="${Math.round(size * 75)}" b="${bold ? 1 : 0}" kern="0" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${face}"/><a:ea typeface="${face}"/></a:rPr>`;
  return `<a:r>${rpr}<a:t>${escapeXml(text)}</a:t></a:r>`;
}

function paragraphsOf(runs: LaidOutBox['wrappedRuns'], boxTone: string | undefined, day: LaidOutDiagram['day'], align: string): string {
  return runs.map((r, i) => {
    const pitch = r.lines.length > 1 ? r.lineYs[1]! - r.lineYs[0]! : Math.round(r.size * LINE_HEIGHT_EM);
    const prev = i > 0 ? runs[i - 1]! : undefined;
    const prevPitch = prev ? (prev.lines.length > 1 ? prev.lineYs[1]! - prev.lineYs[0]! : Math.round(prev.size * LINE_HEIGHT_EM)) : 0;
    const before = prev ? Math.max(0, r.lineYs[0]! - prev.lineYs[prev.lineYs.length - 1]! - pitch) : 0;
    void prevPitch;
    const base = hex(runColorOf(r.tone, boxTone, day));
    const lines = r.lines.map((ln, k) => {
      const spans = r.lineSpans?.[k];
      const body = spans ? spans.map(sp => runXml(sp.text, r.size, sp.bold === true || r.weight === 700, r.mono, sp.tone ? hex(textColorOf(sp.tone, day)) : base)).join('') : runXml(ln, r.size, r.weight === 700, r.mono, base);
      return (k ? `<a:br><a:rPr lang="ja-JP" sz="${Math.round(r.size * 75)}"/></a:br>` : '') + body;
    }).join('');
    // `indent` (room for a step badge / icon) narrows and shifts the whole run: every line of it (lib/emit-common.ts renderTextRuns)
    const ind = r.indent ? ` marL="${emu(r.indent)}"` : '';
    return `<a:p><a:pPr algn="${align}"${ind}><a:lnSpc><a:spcPts val="${Math.round(pitch * 75)}"/></a:lnSpc><a:spcBef><a:spcPts val="${Math.round(before * 75)}"/></a:spcBef></a:pPr>${lines}</a:p>`;
  }).join('');
}

function boxXml(id: number, name: string, b: LaidOutBox, day: LaidOutDiagram['day'], opts: {frame?: boolean; padX?: number; padY?: number; defaultAlign?: 'left' | 'center' | 'right'; noWrap?: boolean} = {}): string {
  const style = resolveBoxStyle(b.tone, day, b.dashed);
  const px = opts.padX ?? b.padX ?? BOX_PAD_X, py = opts.padY ?? b.padY ?? BOX_PAD_Y;
  const frame = opts.frame ?? b.frame !== false;
  const rx = Math.min(b.w, b.h) > 0 ? Math.round((8 / Math.min(b.w, b.h)) * 100000) : 0;
  const al = b.align ?? opts.defaultAlign ?? 'left';
  const align = al === 'center' ? 'ctr' : al === 'right' ? 'r' : 'l';
  const paras = paragraphsOf(b.wrappedRuns, b.tone, day, align);
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

export function buildSlide(ld: LaidOutDiagram, name: string): Built {
  const day = ld.day;
  const rep: Report = {name, bandTypes: {}, nativeShapes: 0, unhandledBands: {}, connects: 0, glued: 0, halfGlued: 0, unglued: 0, fitFailed: [], worstDeviationPx: 0, offCentreEnds: 0, glueEnds: 0, dupIds: 0, segHist: {}};
  let nextId = 2;
  const idOf = new Map<string, number>(); // DSL id -> shape id
  const rectOf = new Map<string, {x: number; y: number; w: number; h: number}>();
  const parts: string[] = [];
  const bump = (m: Record<string, number>, k: string): void => { m[k] = (m[k] ?? 0) + 1; };
  const addBox = (b: LaidOutBox): string => {
    const id = nextId++;
    if (b.id) { idOf.set(b.id, id); rectOf.set(b.id, b); }
    rep.nativeShapes++;
    return boxXml(id, b.id ?? `box-${id}`, b, day);
  };
  const group = (id: number, name: string, r: {x: number; y: number; w: number; h: number}, inner: string): string =>
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${emu(r.x)}" y="${emu(r.y)}"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/><a:chOff x="${emu(r.x)}" y="${emu(r.y)}"/><a:chExt cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm></p:grpSpPr>${inner}</p:grpSp>`;
  const bandsToDo: LaidOutBand[] = ld.laidOut;
  for (const band of bandsToDo) {
    bump(rep.bandTypes, band.type);
    switch (band.type) {
      case 'box': case 'banner': parts.push(addBox(band as unknown as LaidOutBox)); break;
      case 'caption': { // text only: no frame, no padding (the svg writes it at band.x / band.y)
        const id = nextId++;
        rep.nativeShapes++;
        parts.push(boxXml(id, `caption-${id}`, band as unknown as LaidOutBox, day, {frame: false, padX: 0, padY: 0, defaultAlign: 'center'}));
        delete rep.unhandledBands.caption;
        break;
      }
      case 'row': case 'grid': {
        const gid = nextId++;
        const inner = band.children.map(addBox).join('');
        const r = band.type === 'row' ? band : {x: band.x, y: Math.min(...band.children.map(c => c.y)), w: band.w, h: Math.max(...band.children.map(c => c.y + c.h)) - Math.min(...band.children.map(c => c.y))};
        parts.push(group(gid, `${band.type}${'id' in band && band.id ? '-' + band.id : ''}`, r, inner));
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
      default: bump(rep.unhandledBands, band.type);
    }
  }
  // connectors (after the shapes, so they sit on top as in the svg)
  for (const c of ld.connects as LaidOutConnect[]) {
    rep.connects++;
    if (c.annot) { rep.unglued++; continue; }
    const fit = fitConnector(c.points);
    if (!fit.ok) { rep.fitFailed.push({why: fit.why, n: 1}); rep.unglued++; continue; }
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
  // connector labels: a text box of their own (a cxnSp cannot hold text), so they stay where they were when a box moves -- ADR 0025 known limit
  for (const c of ld.connects as LaidOutConnect[]) {
    if (!c.label) continue;
    const r = c.labelBox ?? (c.labelX !== undefined && c.labelY !== undefined ? {x: c.labelX - 60, y: c.labelY - 12, w: 120, h: 24} : undefined);
    if (!r) continue;
    const id = nextId++;
    const size = ld.roles.label ?? 14;
    const fake = {...r, wrappedRuns: [{text: c.label, size, weight: 400, mono: false, lines: [c.label], lineYs: [Math.round(size * 1.0)]}], align: 'center', tone: undefined} as unknown as LaidOutBox;
    parts.push(boxXml(id, `label-${escapeXml(c.fromId)}-${escapeXml(c.toId)}`, fake, day, {frame: false, padX: 0, padY: 0, defaultAlign: 'center', noWrap: true}));
    rep.labels = (rep.labels ?? 0) + 1;
  }
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${parts.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]);
  rep.dupIds = ids.length - new Set(ids).size;
  return {xml, widthEmu: emu(ld.width), heightEmu: emu(ld.canvasHeight), report: rep};
}

const TEMPLATE = new URL('./template/', import.meta.url);

function templateFiles(dir = TEMPLATE, prefix = ''): {name: string; data: Buffer}[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? templateFiles(new URL(e.name + '/', dir), prefix + e.name + '/') : [{name: prefix + e.name, data: fs.readFileSync(new URL(e.name, dir))}]);
}

export interface Extra {files: Record<string, Buffer>; slideRels: string; defaults: {ext: string; type: string}[]}

/** One slide on the fixed package template (spike/pptx/template, the skeleton PowerPoint opens); only the slide, its rels, the slide size and [Content_Types] change. */
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

export async function loadLaidOut(file: string): Promise<{laidOut: LaidOutDiagram; svg: string}> {
  const abs = path.resolve(file);
  const cfg = loadConfig(path.dirname(abs));
  const d = await loadDiagram(abs, USE_BIZ ? {...cfg, fonts: BIZ_FILES} : cfg, {});
  const r = await renderDiagram(d, {name: path.basename(abs, '.ts') + '.svg', budget: 'cacheOnly'});
  return {laidOut: r.laidOut, svg: r.svg};
}

async function main(): Promise<void> {
  register(new URL('../../lib/resolve-hook.ts', import.meta.url));
  const [src, outFile] = process.argv.slice(2);
  if (!src || !outFile) throw new Error('usage: run.ts <example.ts> <out.pptx>');
  const {laidOut, svg} = await loadLaidOut(src);
  const built = buildSlide(laidOut, path.basename(src));
  const a = packPptx(built.xml, built.widthEmu, built.heightEmu);
  const b = packPptx(built.xml, built.widthEmu, built.heightEmu);
  fs.writeFileSync(outFile, a);
  fs.writeFileSync(outFile.replace(/\.pptx$/, '.svg'), svg);
  const sha = (x: Buffer): string => createHash('sha256').update(x).digest('hex').slice(0, 12);
  console.log(JSON.stringify({...built.report, bytes: a.length, deterministic: sha(a) === sha(b)}, null, 1));
  closeMeasurer();
}
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
