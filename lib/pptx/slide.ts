import {escapeXml} from '../emit-common.ts';
import {currentFontSpecs} from '../measure.ts';
import type {LaidOutDiagram, LaidOutBand} from '../types/index.ts';
import type {LaidOutBox} from '../types/text-bands.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import {fitConnector, evalConnector, maxDeviation} from './geom.ts';
import {PPTX_CHART_HANDLERS, PPTX_HANDLERS, type PptxMode} from './handlers.ts';
import {emu, type Rect, type Fonts} from './xml.ts';
import {boxXml, groupFrameXml, groupXml, anchorXml, picXml} from './shapes.ts';
import {plainBox} from './text.ts';
import {tableXml} from './table.ts';
import {siteOf, rowArrowXml, connectorXml, freeformXml, type Glue} from './connectors.ts';
import {bandImage, rasterize} from './image-band.ts';
import type {Extra} from './package.ts';

// The font measured by the project and written here must match (ADR 0027); BIZ UDPGothic is the PPTX default.
const DEFAULT_FONT = 'BIZ UDPGothic';
const DEFAULT_MONO_FONT = 'BIZ UDGothic';

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
  segHist: Record<string, number>;
  labels?: number;
}

export interface PptxOptions {font?: string; monoFont?: string; pngScale?: number; name?: string}
export interface Built {xml: string; widthEmu: number; heightEmu: number; report: Report; extra: Extra}

const bump = (m: Record<string, number>, k: string): void => { m[k] = (m[k] ?? 0) + 1; };
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
/** Font size of the small badges (tag, stamp, step) a box carries beside its main shape. */
const badgeSize = (r: Rect): number => Math.min(12, Math.max(8, r.h * 0.48));

/** Builds the one slide: the order shapes are added in is the shape id order, which the output's byte determinism depends on. */
class SlideBuilder {
  private nextId = 2;
  private readonly idOf = new Map<string, number>(); // DSL id -> shape id
  private readonly rectOf = new Map<string, Rect>();
  private readonly parts: string[] = [];
  private readonly media: Record<string, Buffer> = {};
  private readonly rels: string[] = [];
  private imageNo = 0;
  private readonly fonts: Fonts;
  private readonly measuredFonts: string[];
  readonly rep: Report;
  private readonly ld: LaidOutDiagram;
  private readonly opts: PptxOptions;

  constructor(ld: LaidOutDiagram, name: string, opts: PptxOptions) {
    this.ld = ld;
    this.opts = opts;
    this.fonts = {sans: opts.font ?? DEFAULT_FONT, mono: opts.monoFont ?? opts.font ?? DEFAULT_MONO_FONT};
    this.measuredFonts = [...new Set(Object.values(currentFontSpecs() ?? {}).flatMap(f => [f?.regular, f?.bold]).filter((f): f is string => !!f).map(f => f.replace(/#\d+$/, '')))];
    this.rep = {name, bandTypes: {}, nativeShapes: 0, unhandledBands: {}, connects: 0, glued: 0, halfGlued: 0, unglued: 0, fitFailed: [], worstDeviationPx: 0, offCentreEnds: 0, glueEnds: 0, dupIds: 0, segHist: {}};
  }

  private get day(): LaidOutDiagram['day'] { return this.ld.day; }
  private id(): number { return this.nextId++; }
  /** Remember a DSL id so connectors can glue to this shape. */
  private register(dslId: string | undefined, shapeId: number, rect: Rect): void {
    if (dslId) { this.idOf.set(dslId, shapeId); this.rectOf.set(dslId, rect); }
  }

  private box(b: LaidOutBox): string {
    const id = this.id();
    this.register(b.id, id, b);
    this.rep.nativeShapes++;
    const main = boxXml(id, b.id ?? `box-${id}`, b, this.day, {fonts: this.fonts});
    if (!b.tag && !b.stamp && b.step === undefined && !b.icon) return main;
    const badge = (text: string, r: Rect, name: string, frame = true): string =>
      boxXml(this.id(), name, plainBox(r, text, badgeSize(r), 700, badgeSize(r), b.tone), this.day, {frame, padX: 2, padY: 1, defaultAlign: 'center', noWrap: true, fonts: this.fonts});
    const extra: string[] = [];
    if (b.tag && b.tagBox) extra.push(badge(b.tag, b.tagBox, `tag-${id}`));
    if (b.stamp) extra.push(badge(b.stamp, {x: b.x + b.w - (b.stampW ?? 64) - 8, y: b.y + b.h - 22, w: b.stampW ?? 64, h: 18}, `stamp-${id}`));
    // the icon glyph is not drawn yet (ADR 0027 follow-up): an empty frame in its place would read as a real shape
    if (b.step !== undefined) extra.push(badge(String(b.step), {x: b.x + 8 + (b.icon ? 34 : 0), y: b.y + 8, w: 24, h: 24}, `step-${id}`));
    const minY = Math.min(b.y, b.tagBox?.y ?? b.y), maxY = Math.max(b.y + b.h, (b.tagBox?.y ?? b.y) + (b.tagBox?.h ?? 0));
    return groupXml(this.id(), `box-parts-${b.id ?? id}`, {x: b.x, y: minY, w: b.w, h: maxY - minY}, main + extra.join(''));
  }

  private caption(band: LaidOutBox): void { // text only: no frame, no padding (the svg writes it at band.x / band.y)
    const id = this.id();
    this.rep.nativeShapes++;
    this.parts.push(boxXml(id, `caption-${id}`, band, this.day, {frame: false, padX: 0, padY: 0, defaultAlign: 'center', fonts: this.fonts}));
  }

  private rowOrGrid(band: Extract<LaidOutBand, {type: 'row' | 'grid'}>): void {
    const gid = this.id();
    const inner = band.children.map(c => this.box(c)).join('');
    const r = band.type === 'row' ? band : {x: band.x, y: Math.min(...band.children.map(c => c.y)), w: band.w, h: Math.max(...band.children.map(c => c.y + c.h)) - Math.min(...band.children.map(c => c.y))};
    this.parts.push(groupXml(gid, `${band.type}${'id' in band && band.id ? '-' + band.id : ''}`, r, inner));
    if (band.type !== 'row') return;
    for (const [arrowIndex, a] of band.arrows.entries()) {
      const nearest = (x: number, y: number) => band.children.map(c => ({c, d: Math.min(Math.abs(x - c.x), Math.abs(x - c.x - c.w), Math.abs(y - c.y), Math.abs(y - c.y - c.h))})).sort((u, v) => u.d - v.d)[0];
      const fit = fitConnector([{x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}]);
      if (!fit.ok) continue;
      const glue = (n: ReturnType<typeof nearest>, p: {x: number; y: number}): Glue | undefined => {
        const sid = n?.c.id ? this.idOf.get(n.c.id) : undefined;
        return sid !== undefined && n && n.d <= 2 ? {id: sid, site: siteOf(n.c, p, '')} : undefined;
      };
      this.parts.push(rowArrowXml(this.id(), `row-arrow-${arrowIndex}`, fit.x, glue(nearest(a.x1, a.y1), {x: a.x1, y: a.y1}), glue(nearest(a.x2, a.y2), {x: a.x2, y: a.y2})));
    }
  }

  private groupFrame(band: Extract<LaidOutBand, {type: 'group'}>): void {
    const id = this.id();
    this.register(band.id, id, band);
    this.rep.nativeShapes++;
    this.parts.push(groupFrameXml(id, band.id ?? 'group-' + id, band, band.tone, band.dashed, this.day));
  }

  private table(band: Extract<LaidOutBand, {type: 'table'}>): void {
    const id = this.id();
    this.register(band.id, id, band);
    this.parts.push(tableXml(id, band, this.ld, this.fonts));
    this.rep.nativeShapes++;
  }

  /** A band with no native mapping: drawn alone as SVG + PNG and placed as one picture; an invisible anchor keeps its DSL id glue-able. */
  private image(band: LaidOutBand, bandIndex: number): void {
    const mode: PptxMode = band.type === 'chart' ? PPTX_CHART_HANDLERS[band.kind] : PPTX_HANDLERS[band.type].mode;
    if (mode !== 'image') throw new Error(`native PPTX handler missing for ${band.type}`);
    bump(this.rep.unhandledBands, band.type === 'chart' ? `chart:${band.kind}` : band.type);
    const image = bandImage(this.ld, band, bandIndex);
    const n = ++this.imageNo, pngRid = `rId${10 + n * 2}`, svgRid = `rId${11 + n * 2}`;
    this.media[`ppt/media/image${n}.png`] = rasterize(image.pngSvg, this.measuredFonts, this.opts.pngScale ?? 2);
    this.media[`ppt/media/image${n}.svg`] = Buffer.from(image.svg);
    this.rels.push(`<Relationship Id="${pngRid}" Type="${IMAGE_REL}" Target="../media/image${n}.png"/><Relationship Id="${svgRid}" Type="${IMAGE_REL}" Target="../media/image${n}.svg"/>`);
    this.parts.push(picXml(this.id(), `${band.type}-${bandIndex}`, image, pngRid, svgRid));
    if ('id' in band && band.id) {
      const rect = {x: band.x, y: band.y, w: band.w, h: 'h' in band ? band.h : image.h};
      const anchorId = this.id();
      this.register(band.id, anchorId, rect);
      this.parts.push(anchorXml(anchorId, `anchor-${band.id}`, rect));
    }
  }

  addBand(band: LaidOutBand, bandIndex: number): void {
    bump(this.rep.bandTypes, band.type);
    switch (band.type) {
      case 'box': case 'banner': this.parts.push(this.box(band as unknown as LaidOutBox)); break;
      case 'caption': this.caption(band as unknown as LaidOutBox); break;
      case 'row': case 'grid': this.rowOrGrid(band); break;
      case 'group': this.groupFrame(band); break;
      case 'table': this.table(band); break;
      default: this.image(band, bandIndex);
    }
  }

  /** Connectors go after the shapes, so they sit on top as in the svg. */
  addConnects(): void {
    const {rep} = this;
    for (const c of this.ld.connects as LaidOutConnect[]) {
      rep.connects++;
      if (c.annot) { rep.unglued++; this.parts.push(freeformXml(this.id(), c, this.day)); continue; }
      const fit = fitConnector(c.points);
      if (!fit.ok) { rep.fitFailed.push({why: fit.why, n: 1}); rep.unglued++; this.parts.push(freeformXml(this.id(), c, this.day)); continue; }
      const x = fit.x;
      bump(rep.segHist, x.prst);
      rep.worstDeviationPx = Math.max(rep.worstDeviationPx, maxDeviation(c.points, evalConnector(x)));
      const from = this.idOf.get(c.fromId), to = this.idOf.get(c.toId);
      const fr = this.rectOf.get(c.fromId), tr = this.rectOf.get(c.toId);
      const sFrom = from !== undefined && fr ? siteOf(fr, c.points[0]!, c.fromLabel) : undefined;
      const sTo = to !== undefined && tr ? siteOf(tr, c.points[c.points.length - 1]!, c.toLabel) : undefined;
      for (const s of [sFrom, sTo]) if (s) { rep.glueEnds++; if (s.dist > 1) rep.offCentreEnds++; }
      if (sFrom && sTo) rep.glued++; else if (sFrom || sTo) rep.halfGlued++; else rep.unglued++;
      this.parts.push(connectorXml(this.id(), c, x, this.day, sFrom && from !== undefined ? {id: from, site: sFrom} : undefined, sTo && to !== undefined ? {id: to, site: sTo} : undefined));
    }
  }

  /** Connector labels: a text box of their own (a cxnSp cannot hold text), so they stay where they were when a box moves -- ADR 0027 known limit. */
  addLabels(): void {
    for (const c of this.ld.connects as LaidOutConnect[]) {
      if (!c.label) continue;
      const r = c.labelBox ?? (c.labelX !== undefined && c.labelY !== undefined ? {x: c.labelX - 60, y: c.labelY - 12, w: 120, h: 24} : undefined);
      if (!r) continue;
      const size = this.ld.roles.label ?? 14;
      this.parts.push(boxXml(this.id(), `label-${escapeXml(c.fromId)}-${escapeXml(c.toId)}`, plainBox(r, c.label, size, 400, Math.round(size * 1.0), undefined), this.day, {frame: false, padX: 0, padY: 0, defaultAlign: 'center', noWrap: true, fonts: this.fonts}));
      this.rep.labels = (this.rep.labels ?? 0) + 1;
    }
  }

  finish(): Built {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${this.parts.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]);
    this.rep.dupIds = ids.length - new Set(ids).size;
    const {ld} = this;
    return {xml, widthEmu: emu(Math.max(96, ld.width)), heightEmu: emu(Math.max(96, ld.canvasHeight)), report: this.rep, extra: {files: this.media, slideRels: this.rels.join(''), defaults: this.imageNo ? [{ext: 'png', type: 'image/png'}, {ext: 'svg', type: 'image/svg+xml'}] : []}};
  }
}

export function buildSlide(ld: LaidOutDiagram, name: string, opts: PptxOptions = {}): Built {
  const slide = new SlideBuilder(ld, name, opts);
  for (const [i, band] of ld.laidOut.entries()) slide.addBand(band, i);
  slide.addConnects();
  slide.addLabels();
  return slide.finish();
}
