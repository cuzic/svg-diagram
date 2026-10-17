// LaidOutDiagram -> the one slide, as a pure function (ADR 0027). I/O stays in emit.ts: the template, resvg and zip.
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import {fitConnector, siteIndex} from './geom.ts';
import {emu, type Fonts} from './xml.ts';
import {boxXml, plainBox} from './shapes.ts';
import {connectorXml, freeformXml, type Glue} from './connectors.ts';
import {bandXml, type Ctx} from './bands.ts';
import type {SlidePlan} from './package.ts';
import {toneEnv} from '../tokens.ts';

// The font measured by the project and written here must match (ADR 0027); BIZ UDPGothic is the PPTX default.
const DEFAULT_FONT = 'BIZ UDPGothic';
const DEFAULT_MONO_FONT = 'BIZ UDGothic';

/** The typefaces written into the runs: `font` (if given) for everything, else the defaults. */
export const fontsOf = (font?: string): Fonts => ({sans: font ?? DEFAULT_FONT, mono: font ?? DEFAULT_MONO_FONT});

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const glueOf = (ctx: Ctx, dslId: string, p: {x: number; y: number}, label: string): Glue | undefined => {
  const shape = ctx.glue.get(dslId);
  return shape ? {id: shape.id, idx: siteIndex(shape.rect, p, label)} : undefined;
};

/** A route is a bent connector glued at both ends where it can be; annotations and routes no preset fits are freeform lines. */
function connectXml(c: LaidOutConnect, ctx: Ctx): string {
  const fit = c.annot ? undefined : fitConnector(c.points);
  if (!fit?.ok) return freeformXml(ctx.next(), c, ctx.ld.day, ctx.tones);
  return connectorXml(ctx.next(), c, fit.x, ctx.ld.day, ctx.tones, glueOf(ctx, c.fromId, c.points[0]!, c.fromLabel), glueOf(ctx, c.toId, c.points[c.points.length - 1]!, c.toLabel));
}

/** A connector label is a text box of its own (a cxnSp cannot hold text), so it stays where it was when a box moves -- ADR 0027 known limit. */
function labelXml(c: LaidOutConnect, ctx: Ctx): string {
  const r = c.labelBox ?? (c.labelX !== undefined && c.labelY !== undefined ? {x: c.labelX - 60, y: c.labelY - 12, w: 120, h: 24} : undefined);
  if (!c.label || !r) return '';
  const size = ctx.ld.roles.label;
  return boxXml(ctx.next(), `label-${c.fromId}-${c.toId}`, plainBox(r, c.label, {size, weight: 400, tone: undefined, frame: false, padX: 0, padY: 0}), ctx.ld.day, ctx.tones, ctx.fonts);
}

export function planSlide(ld: LaidOutDiagram, fonts: Fonts): SlidePlan {
  let last = 1;
  // the tone overrides are resolved here, from the diagram itself: the native shapes draw them as the svg does (ADR 0031 §2)
  const ctx: Ctx = {ld, tones: toneEnv(ld.tones), fonts, next: () => ++last, glue: new Map(), pictures: []};
  const shapes = ld.laidOut.map((band, i) => bandXml(band, ctx, i));
  const lines = ld.connects.map(c => connectXml(c, ctx)); // after the shapes, so they sit on top as in the svg
  const labels = ld.connects.map(c => labelXml(c, ctx));
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${[...shapes, ...lines, ...labels].join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  return {xml, cx: emu(Math.max(96, ld.width)), cy: emu(Math.max(96, ld.canvasHeight)), pictures: ctx.pictures};
}
