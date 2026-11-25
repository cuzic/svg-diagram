// LaidOutDiagram -> the one slide, as a pure function (ADR 0027). I/O stays in emit.ts: the template, resvg and zip.
import {namedAs} from './prims.ts';
import {must} from '../must.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import {fitConnector, siteIndex} from './geom.ts';
import {attr, emu, hex, type Fonts} from './xml.ts';
import {boxXml, plainBox} from './shapes.ts';
import {connectorXml, freeformXml, type Glue} from './connectors.ts';
import type {BandXml, Ctx, PlanSpan, PptxSpans} from './adapter.ts';
import type {LaidOutBand} from '../types/index.ts';
import type {SlidePlan} from './package.ts';
import {PALETTE, mapOf, paintOf, toneEnv} from '../tokens.ts';

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
  // an end on a group's frame (connect({via}), ADR 0069 D2) is not glued: glued to its box, it would be drawn back to the box's edge, inside
  // the frame, as soon as the box moves (LibreOffice: on opening). Every other end is glued as before.
  const from = c.fromVia ? undefined : glueOf(ctx, c.fromId, must(c.points[0]), c.fromLabel), to = c.toVia ? undefined : glueOf(ctx, c.toId, must(c.points[c.points.length - 1]), c.toLabel);
  return connectorXml(ctx.next(), c, fit.x, ctx.ld.day, ctx.tones, from, to);
}

/** A connector label is a text box of its own (a cxnSp cannot hold text), so it stays where it was when a box moves -- ADR 0027 known limit. */
function labelXml(c: LaidOutConnect, ctx: Ctx): string {
  const r = c.labelBox ?? (c.labelX !== undefined && c.labelY !== undefined ? {x: c.labelX - 60, y: c.labelY - 12, w: 120, h: 24} : undefined);
  if (!c.label || !r) return '';
  const size = ctx.ld.roles.label;
  return boxXml(ctx.next(), namedAs('label', c.label), plainBox(r, c.label, {size, weight: 400, tone: undefined, frame: false, padX: 0, padY: 0}), ctx.ld.day, ctx.tones, ctx.fonts);
}

function validateSpan(count: number, available: number): void {
  if (!Number.isInteger(count) || count < 1 || count > available) {
    throw new Error(`pptx: span must cover between 1 and ${available} following bands (got ${count})`);
  }
}

function bandsXml(ctx: Ctx, from: number, to: number, bandXml: BandXml<LaidOutBand>, spans: PptxSpans): string[] {
  const bands = ctx.ld.laidOut, out: string[] = [];
  for (let index = from; index < to;) {
    const band = must(bands[index]);
    // The lookup key selects a hook that receives this exact laid-out band type.
    const plan = spans[band.type] as PlanSpan<LaidOutBand> | undefined;
    const drawn = plan?.(band, {
      ctx, index, following: bands.slice(index + 1, to),
      drawBand: () => bandXml(band, ctx, index),
      drawChildren(count, nested) {
        validateSpan(count, to - index - 1);
        const first = index + 1, end = first + count;
        return nested ? bandsXml(ctx, first, end, bandXml, spans).join('')
          : bands.slice(first, end).map((child, offset) => bandXml(child, ctx, first + offset)).join('');
      },
    });
    if (drawn) validateSpan(drawn.count, to - index - 1);
    out.push(drawn?.xml ?? bandXml(band, ctx, index));
    index += 1 + (drawn?.count ?? 0);
  }
  return out;
}

export function planSlideWith(ld: LaidOutDiagram, fonts: Fonts, bandXml: BandXml<LaidOutBand>, {title = '', desc = '', stage, spans = {}}: {title?: string; desc?: string; stage?: number; spans?: PptxSpans} = {}): SlidePlan {
  let last = 1;
  // the tone overrides are resolved here, from the diagram itself: the native shapes draw them as the svg does (ADR 0031 §2)
  const ctx: Ctx = {ld, tones: toneEnv(ld.tones), fonts, stage, next: () => ++last, glue: new Map(), pictures: [], count: new Map()};
  const shapes = bandsXml(ctx, 0, ld.laidOut.length, bandXml, spans);
  const lines = ld.connects.map(c => connectXml(c, ctx)); // after the shapes, so they sit on top as in the svg
  const labels = ld.connects.map(c => labelXml(c, ctx));
  // a dark figure: every colour the shapes were given is a light token, recoloured here as the svg is (tokens.ts recolor), on a dark background
  const dark = mapOf(ctx.tones, ld.appearance) !== null, paint = paintOf(ctx.tones, ld.appearance);
  let body = [...shapes, ...lines, ...labels].join('');
  if (dark) body = body.replace(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g, (_m, h: string) => `<a:srgbClr val="${hex(paint(`#${h.toLowerCase()}`))}"`);
  const bg = dark ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(paint(PALETTE.bg))}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : '';
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld${title ? ` name="${attr(title)}"` : ''}>${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  return {xml, cx: emu(Math.max(96, ld.width)), cy: emu(Math.max(96, ld.canvasHeight)), pictures: ctx.pictures, ...(title ? {title} : {}), ...(desc ? {desc} : {})};
}
