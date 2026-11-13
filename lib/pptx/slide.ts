// LaidOutDiagram -> the one slide, as a pure function (ADR 0027). I/O stays in emit.ts: the template, resvg and zip.
import {namedAs} from './prims.ts';
import {must} from '../must.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import {fitConnector, siteIndex} from './geom.ts';
import {attr, emu, hex, type Fonts} from './xml.ts';
import {diagramDesc, diagramTitle} from '../rules.ts';
import {boxXml, groupXml, plainBox} from './shapes.ts';
import {partName} from './parts-group.ts';
import {partStep} from '../parts.ts';
import {connectorXml, freeformXml, type Glue} from './connectors.ts';
import {bandXml, type Ctx} from './bands.ts';
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
  return connectorXml(ctx.next(), c, fit.x, ctx.ld.day, ctx.tones, glueOf(ctx, c.fromId, must(c.points[0]), c.fromLabel), glueOf(ctx, c.toId, must(c.points[c.points.length - 1]), c.toLabel));
}

/** A connector label is a text box of its own (a cxnSp cannot hold text), so it stays where it was when a box moves -- ADR 0027 known limit. */
function labelXml(c: LaidOutConnect, ctx: Ctx): string {
  const r = c.labelBox ?? (c.labelX !== undefined && c.labelY !== undefined ? {x: c.labelX - 60, y: c.labelY - 12, w: 120, h: 24} : undefined);
  if (!c.label || !r) return '';
  const size = ctx.ld.roles.label;
  return boxXml(ctx.next(), namedAs('label', c.label), plainBox(r, c.label, {size, weight: 400, tone: undefined, frame: false, padX: 0, padY: 0}), ctx.ld.day, ctx.tones, ctx.fonts);
}

/**
 * The bands from..to as shapes. A group frame and the bands it holds (its title and contents: `span`, ADR 0054 D5) are one group, named after
 * the title; nested groups nest. A span whose bands do not lie inside the frame (the bands were filtered or moved after layout) is not grouped.
 */
function bandsXml(ld: LaidOutDiagram, ctx: Ctx, from: number, to: number): string[] {
  const out: string[] = [];
  for (let i = from; i < to;) {
    const band = must(ld.laidOut[i]), span = band.type === 'group' ? Math.min(band.span ?? 0, to - i - 1) : 0;
    const held = ld.laidOut.slice(i + 1, i + 1 + span);
    // (8px of slack: a title or child may sit a few px past the frame's grid-snapped top or its padding)
    if (band.type === 'group' && span > 0 && held.every(b => !('y' in b) || !('h' in b) || (b.y >= band.y - 8 && b.y + b.h <= band.y + band.h + 8))) {
      const inner = [bandXml(band, ctx, i), ...bandsXml(ld, ctx, i + 1, i + 1 + span)].join('');
      const title = band.title ?? '';
      out.push(groupXml(ctx.next(), partName(partStep('group', band.id ?? i, title)), band, inner));
      i += 1 + span;
    } else if (band.type === 'swimlane' && (band.span ?? 0) > 0 && i + (band.span ?? 0) < to) {
      // a swimlane and its steps (separate box bands after it): one group, the lanes a group inside it (ADR 0054 D9.2)
      // the outer group takes the band's own name (`swimlane`, `swimlane 2`, with its id), the lanes' group is renamed `lanes`
      const span = band.span ?? 0, drawn = bandXml(band, ctx, i), own = (/ name="(swimlane[^"]*)"/.exec(drawn)?.[1] ?? 'swimlane').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
      const lanes = drawn.replace(/ name="swimlane[^"]*"/, ' name="lanes"');
      const steps = ld.laidOut.slice(i + 1, i + 1 + span).map((b, k) => bandXml(b, ctx, i + 1 + k)).join('');
      out.push(groupXml(ctx.next(), own, band, lanes + steps));
      i += 1 + span;
    } else { out.push(bandXml(band, ctx, i)); i++; }
  }
  return out;
}

export function planSlide(ld: LaidOutDiagram, fonts: Fonts): SlidePlan {
  let last = 1;
  // the tone overrides are resolved here, from the diagram itself: the native shapes draw them as the svg does (ADR 0031 §2)
  const ctx: Ctx = {ld, tones: toneEnv(ld.tones), fonts, next: () => ++last, glue: new Map(), pictures: [], count: new Map()};
  const shapes = bandsXml(ld, ctx, 0, ld.laidOut.length);
  const lines = ld.connects.map(c => connectXml(c, ctx)); // after the shapes, so they sit on top as in the svg
  const labels = ld.connects.map(c => labelXml(c, ctx));
  // a document figure's accessible name and description (the svg's <title> and <desc>): the slide's name, the file's title and description
  const title = ld.medium === 'doc' ? diagramTitle(ld) : '', desc = title ? diagramDesc(ld) : '';
  // a dark figure: every colour the shapes were given is a light token, recoloured here as the svg is (tokens.ts recolor), on a dark background
  const dark = mapOf(ctx.tones, ld.appearance) !== null, paint = paintOf(ctx.tones, ld.appearance);
  let body = [...shapes, ...lines, ...labels].join('');
  if (dark) body = body.replace(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g, (_m, h: string) => `<a:srgbClr val="${hex(paint(`#${h.toLowerCase()}`))}"`);
  const bg = dark ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(paint(PALETTE.bg))}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : '';
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld${title ? ` name="${attr(title)}"` : ''}>${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  return {xml, cx: emu(Math.max(96, ld.width)), cy: emu(Math.max(96, ld.canvasHeight)), pictures: ctx.pictures, ...(title ? {title} : {}), ...(desc ? {desc} : {})};
}
