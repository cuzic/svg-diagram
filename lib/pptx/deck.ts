// A deck of 16:9 slides as a .pptx package, as pure functions (ADR 0055). Each figure is one planSlide() (slide.ts), moved onto its slide
// and scaled there: positions, sizes, text, table rows and columns, insets and line widths are multiplied by the same factor, so the
// shapes stay native and editable and the text shrinks with them (PowerPoint does not scale text when a group is resized, so the figure
// is not one scaled group). Around it go the heading, the lead, the callouts and the source line; the notes go to the notes page.
// Measuring the text and drawing the PNGs are the shell's (../pptx-deck-edge.ts, ../../pptx-deck.ts).
import {escapeXml} from '../emit-common.ts';
import {wrapText} from '../wrap.ts';
import {must} from '../must.ts';
import type {Picture} from './image-band.ts';
import {imageRids, type Entry, type SlidePlan} from './package.ts';
import {TEMPLATE} from './template.ts';
import {attr, emu, sp, type Fonts} from './xml.ts';

/** The slide, in px at 96 dpi: 13.333 × 7.5 in, PowerPoint's 16:9. */
export const SLIDE_W = 1280, SLIDE_H = 720;
const MARGIN_X = 56, TOP = 32, BOTTOM = 28, GAP = 16, FIG_PAD = 6;
/** A figure is never drawn larger than this many times its own size: past it the text looks shouted. */
export const MAX_FIGURE_SCALE = 1.25;
/** The smallest text (pt) a scaled figure may have before the slide is reported as hard to read. */
export const MIN_TEXT_PT = 9;
const LINE = 1.3;

const STYLE = {
  title: {size: 37, bold: true, color: '1F2328'},
  lead: {size: 19, bold: false, color: '5B6370'},
  callout: {size: 16, bold: false, color: '3A4A5A', strong: '1A2A3A', fill: 'EEF4FB', bar: '1F5FA8', padX: 16, padY: 8},
  source: {size: 13, bold: false, color: '6B7280'},
} as const;

/** The width of `text` in px at `size` px, bold or not, in the font the slide is measured with. */
export type TextWidth = (text: string, size: number, bold: boolean) => number;
export interface DeckFigure {plan: SlidePlan; /** Its laid-out size, px. */ w: number; h: number}
export interface DeckSlideIn {title?: string; lead?: string; callouts?: {label?: string; text: string}[]; source?: string; notes?: string; figure?: DeckFigure}
export interface PlannedSlide {
  xml: string;
  notes: string;
  /** The figure's pictures; picture i is the slide's imageRids(i). */
  pictures: Picture[];
  /** How much the figure was scaled, and the size of its smallest text after (pt); null without a figure. */
  scale: number | null;
  minTextPt: number | null;
  /** The slide's text leaves the figure no room, or (without a figure) the text from the top runs into the text from the bottom. */
  noRoom: boolean;
  name: string;
}

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/**
 * A figure's shapes moved by (dx, dy) EMU and scaled by k. What is a length on the slide is scaled; what is in a shape's own path space
 * (a:path w/h, a:pt, a:pos, a:arcTo wR/hR) and angles, colours and ids are not. test/pptx-deck.test.ts lists every numeric attribute the
 * writer emits, so a new one has to be put on one side or the other.
 */
export function placeShapes(xml: string, k: number, dx: number, dy: number): string {
  const s = (v: string): string => String(Math.round(Number(v) * k));
  return xml
    .replace(/<a:(off|chOff) x="(-?\d+)" y="(-?\d+)"\/>/g, (_m, t: string, x: string, y: string) => `<a:${t} x="${Math.round(Number(x) * k) + dx}" y="${Math.round(Number(y) * k) + dy}"/>`)
    .replace(/<a:(ext|chExt) cx="(\d+)" cy="(\d+)"\/>/g, (_m, t: string, cx: string, cy: string) => `<a:${t} cx="${s(cx)}" cy="${s(cy)}"/>`)
    .replace(/<a:gridCol w="(\d+)"/g, (_m, w: string) => `<a:gridCol w="${s(w)}"`)
    .replace(/<a:tr h="(\d+)"/g, (_m, h: string) => `<a:tr h="${s(h)}"`)
    .replace(/<a:tab pos="(\d+)"/g, (_m, p: string) => `<a:tab pos="${s(p)}"`)
    .replace(/<a:(tcPr|bodyPr|pPr)\b[^>]*>/g, tag => tag.replace(/\b(marL|marR|marT|marB|lIns|tIns|rIns|bIns|indent)="(-?\d+)"/g, (_m, a: string, v: string) => `${a}="${s(v)}"`))
    .replace(/(<a:(?:rPr|defRPr|endParaRPr)\b[^>]*?\bsz=")(\d+)"/g, (_m, head: string, v: string) => `${head}${Math.max(100, Math.round(Number(v) * k))}"`)
    .replace(/<a:spcPts val="(\d+)"/g, (_m, v: string) => `<a:spcPts val="${s(v)}"`)
    .replace(/(<a:ln[LRTB]?\b[^>]*?\bw=")(\d+)"/g, (_m, head: string, v: string) => `${head}${Number(v) === 0 ? 0 : Math.max(3175, Math.round(Number(v) * k))}"`);
}

/** The smallest text size (pt) in a slide's XML, or null when it has none. */
export function minTextPt(xml: string): number | null {
  const sizes = [...xml.matchAll(/<a:rPr\b[^>]*?\bsz="(\d+)"/g)].map(m => Number(m[1]) / 100);
  return sizes.length ? Math.min(...sizes) : null;
}

interface Line {text: string; bold: boolean; color: string}

/** `text` wrapped to `width` px; each line a run (or, for a callout, the label's part plain and the rest bold). */
function wrapped(text: string, size: number, width: number, w: TextWidth, bold: boolean): string[] {
  return wrapText(text, {maxWidth: width, atomWidth: a => w(a, size, bold), mode: 'phrase'});
}

function textShape(id: number, name: string, x: number, y: number, width: number, size: number, lines: Line[][], fonts: Fonts, inset = {x: 0, y: 0}): string {
  const pitch = Math.round(size * LINE);
  const rpr = (l: Line) => `<a:rPr lang="ja-JP" sz="${Math.round(size * 75)}" b="${l.bold ? 1 : 0}" kern="0" dirty="0"><a:solidFill><a:srgbClr val="${l.color}"/></a:solidFill><a:latin typeface="${attr(fonts.sans)}"/><a:ea typeface="${attr(fonts.sans)}"/></a:rPr>`;
  const body = lines.map((runs, i) => (i ? `<a:br>${rpr(must(runs[0]))}</a:br>` : '') + runs.map(r => `<a:r>${rpr(r)}<a:t>${escapeXml(r.text)}</a:t></a:r>`).join('')).join('');
  const h = lines.length * pitch + inset.y * 2;
  const spPr = `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(width)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>`;
  const txBody = `<a:bodyPr wrap="square" lIns="${emu(inset.x)}" tIns="${emu(inset.y)}" rIns="${emu(inset.x)}" bIns="${emu(inset.y)}" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr><a:lnSpc><a:spcPts val="${Math.round(pitch * 75)}"/></a:lnSpc></a:pPr>${body}</a:p>`;
  return sp(id, name, spPr, txBody);
}

const rectShape = (id: number, name: string, x: number, y: number, w: number, h: number, fill: string): string =>
  sp(id, name, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln>`,
    '<a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP" dirty="0"/></a:p>');

/** A callout's text split into lines, each line's runs: the label's characters plain, the rest bold. */
function calloutLines(c: {label?: string; text: string}, width: number, w: TextWidth): Line[][] {
  const st = STYLE.callout, label = c.label ?? '', all = label + c.text;
  let at = 0;
  return wrapped(all, st.size, width, w, true).map(line => {
    const start = Math.max(at, all.indexOf(line, at));
    at = start + line.length;
    const cut = Math.min(line.length, Math.max(0, label.length - start));
    return [
      ...(cut > 0 ? [{text: line.slice(0, cut), bold: false, color: st.color}] : []),
      ...(cut < line.length ? [{text: line.slice(cut), bold: true, color: st.strong}] : []),
    ];
  });
}

/** One slide: the heading and lead from the top, the source and callouts from the bottom, the figure scaled into what is left. */
export function planDeckSlide(s: DeckSlideIn, fonts: Fonts, w: TextWidth): PlannedSlide {
  const width = SLIDE_W - 2 * MARGIN_X;
  const fig = s.figure;
  // the figure keeps its own shape ids (the connectors' glue names them); the slide's own shapes come after the largest
  let next = fig ? Math.max(1, ...[...fig.plan.xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => Number(m[1]))) : 1;
  const id = () => ++next;
  const top: string[] = [], bottom: string[] = [];
  let y = TOP;
  if (s.title) {
    const st = STYLE.title, lines = wrapped(s.title, st.size, width, w, st.bold);
    top.push(textShape(id(), 'title', MARGIN_X, y, width, st.size, lines.map(t => [{text: t, bold: st.bold, color: st.color}]), fonts));
    y += lines.length * Math.round(st.size * LINE) + 6;
  }
  if (s.lead) {
    const st = STYLE.lead, lines = wrapped(s.lead, st.size, width, w, st.bold);
    top.push(textShape(id(), 'lead', MARGIN_X, y, width, st.size, lines.map(t => [{text: t, bold: false, color: st.color}]), fonts));
    y += lines.length * Math.round(st.size * LINE);
  }
  let low = SLIDE_H - BOTTOM;
  if (s.source) {
    const st = STYLE.source, lines = wrapped(s.source, st.size, width, w, false), h = lines.length * Math.round(st.size * LINE);
    low -= h;
    bottom.push(textShape(id(), 'source', MARGIN_X, low, width, st.size, lines.map(t => [{text: t, bold: false, color: st.color}]), fonts));
    low -= 10;
  }
  for (const c of [...(s.callouts ?? [])].reverse()) {
    const st = STYLE.callout, lines = calloutLines(c, width - 4 - 2 * st.padX, w);
    const h = lines.length * Math.round(st.size * LINE) + 2 * st.padY;
    low -= h;
    bottom.push(rectShape(id(), 'callout box', MARGIN_X, low, width, h, st.fill) + rectShape(id(), 'callout bar', MARGIN_X, low, 4, h, st.bar)
      + textShape(id(), c.label ? `callout: ${c.label}` : 'callout', MARGIN_X + 4, low, width - 4, st.size, lines, fonts, {x: st.padX, y: st.padY}));
    low -= 10;
  }
  let figureXml = '', scale: number | null = null, small: number | null = null, noRoom = false;
  if (fig) {
    // FIG_PAD on each side: a figure's ink may reach a few px past its laid-out size (a shadow, a label's overhang)
    const roomTop = y + (s.title || s.lead ? GAP : 0) + FIG_PAD, roomH = low - (bottom.length ? GAP - 10 : 0) - roomTop - FIG_PAD;
    const k = Math.min(width / fig.w, roomH / fig.h, MAX_FIGURE_SCALE);
    if (!(k > 0) || roomH < 48) noRoom = true;
    else {
      const fw = fig.w * k, fh = fig.h * k, x0 = MARGIN_X + (width - fw) / 2, y0 = roomTop + (roomH - fh) / 2;
      const inner = must(/<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(fig.plan.xml))[1] ?? '';
      // a dark figure keeps its background as a panel behind it (the slide itself stays light)
      const bg = /<p:bg>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/.exec(fig.plan.xml)?.[1];
      figureXml = (bg ? rectShape(id(), 'figure background', x0, y0, fw, fh, bg) : '') + placeShapes(inner, k, emu(x0), emu(y0));
      scale = k;
      small = minTextPt(placeShapes(inner, k, 0, 0));
    }
  } else if (y > low + 10) noRoom = true;
  const name = s.title ?? fig?.plan.title ?? '';
  // drawn in this order: the heading and lead, the figure (its dark panel first), then the callouts and source on top
  const tree = top.join('') + figureXml + bottom.reverse().join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld${name ? ` name="${attr(name)}"` : ''}><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  return {xml, notes: s.notes ?? '', pictures: fig && !noRoom ? fig.plan.pictures : [], scale, minTextPt: small, noRoom, name};
}

const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const NOTES_CT = 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml';

/** The notes page: one paragraph per line, blank lines kept as empty paragraphs (a break between thoughts), the leading and trailing blank lines dropped. */
function notesXml(template: string, notes: string): string {
  const lines = notes.replace(/\t/g, '    ').split(/\r\n|\r|\n/).map(l => l.trimEnd());
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const empty = '<a:p><a:endParaRPr lang="ja-JP" dirty="0"/></a:p>';
  const paras = lines.length ? lines.map(l => l ? `<a:p><a:r><a:rPr lang="ja-JP" dirty="0"/><a:t xml:space="preserve">${escapeXml(l)}</a:t></a:r></a:p>` : empty).join('') : empty;
  return once(template, /(<p:ph type="body" idx="1"\/>[\s\S]*?<a:lstStyle\/>)[\s\S]*?(<\/p:txBody>)/, (_m, a: string, b: string) => a + paras + b, 'the notes body');
}

/** `text` with `pattern` replaced, which must match: the template is fixed, so a miss means it changed and this code must follow it. */
function once(text: string, pattern: RegExp | string, to: string | ((...m: string[]) => string), what: string): string {
  const re = typeof pattern === 'string' ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')) : pattern;
  if (!re.test(text)) throw new Error(`deck: the pptx template no longer has ${what}`);
  return text.replace(re, to as never);
}

/** Why a slide could not be made, for a slide with or without a figure. */
export const roomMessage = (hasFigure: boolean): string => hasFigure
  ? 'the heading, lead, callouts and source leave no room for the figure: shorten them, or put the figure on a slide of its own'
  : 'the heading and lead run into the callouts and source: shorten them, or split the slide';

/** A warning for a slide whose figure's smallest text is under MIN_TEXT_PT, or null. */
export function smallTextWarning(p: PlannedSlide): string | null {
  if (p.minTextPt === null || p.scale === null || p.minTextPt >= MIN_TEXT_PT) return null;
  const how = p.scale < 1 ? `scaled to ${Math.round(p.scale * 100)}% to fit the slide, its` : 'its';
  return `${how} smallest text is ${p.minTextPt.toFixed(1)}pt (under ${MIN_TEXT_PT}pt): split the figure, or move text off the slide`;
}

/**
 * The package of `slides`: the template with its one slide replaced by these, each with its notes page and pictures; `[Content_Types].xml`
 * first and the rest sorted by name. `pngs[i]` are slide i's pictures' PNGs. Media are numbered across the deck.
 */
export function deckEntries(slides: readonly PlannedSlide[], pngs: readonly (readonly Uint8Array[])[], title?: string, template: readonly {name: string; text: string}[] = TEMPLATE): Entry[] {
  if (pngs.length !== slides.length || slides.some((s, i) => s.pictures.length !== must(pngs[i]).length)) throw new Error('deck: one PNG per picture of every slide');
  const enc = new TextEncoder(), text = (name: string): string => must(template.find(t => t.name === name), name).text;
  const n = slides.length, out: Entry[] = [];
  const perSlide = new Set(['ppt/slides/_rels/slide1.xml.rels', 'ppt/notesSlides/notesSlide1.xml', 'ppt/notesSlides/_rels/notesSlide1.xml.rels']);
  for (const {name, text: t} of template) {
    if (perSlide.has(name)) continue;
    let x = t;
    if (name === 'ppt/presentation.xml') {
      x = once(x, /<p:sldSz[^>]*\/>/, `<p:sldSz cx="${emu(SLIDE_W)}" cy="${emu(SLIDE_H)}"/>`, 'p:sldSz');
      x = once(x, /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, '', 'p:sldIdLst');
      // the schema's order is sldMasterIdLst, notesMasterIdLst, sldIdLst (the template has the slide list first, which pml.xsd rejects)
      x = once(x, /(<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>)/, `$1<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`).join('')}</p:sldIdLst>`, 'p:notesMasterIdLst');
    } else if (name === 'ppt/_rels/presentation.xml.rels') {
      x = once(x, new RegExp(`<Relationship Id="rId\\d+" Type="${SLIDE_REL.replace(/[./]/g, '\\$&')}" Target="slides/slide1.xml"/>`), '', 'the slide relationship');
      x = once(x, '</Relationships>', slides.map((_, i) => `<Relationship Id="rId${100 + i}" Type="${SLIDE_REL}" Target="slides/slide${i + 1}.xml"/>`).join('') + '</Relationships>', 'Relationships');
    } else if (name === '[Content_Types].xml') {
      x = once(x, /<Override PartName="\/ppt\/(?:slides\/slide|notesSlides\/notesSlide)1\.xml"[^>]*\/>/g, '', 'the slide overrides');
      x = once(x, '</Types>', slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${SLIDE_CT}"/><Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="${NOTES_CT}"/>`).join('') + '</Types>', 'Types');
    } else if (name === 'docProps/app.xml') {
      x = once(once(x, '<Slides>1</Slides>', `<Slides>${n}</Slides>`, 'Slides'), '<Notes>1</Notes>', `<Notes>${n}</Notes>`, 'Notes');
      x = once(x, /(<vt:lpstr>Slide Titles<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>)1(<\/vt:i4>)/, `$1${n}$2`, 'the slide titles count');
      x = once(x, /<vt:vector size="4" baseType="lpstr">([\s\S]*?)<vt:lpstr>Slide 1<\/vt:lpstr>/, (_m: string, head: string) => `<vt:vector size="${3 + n}" baseType="lpstr">${head}${slides.map((s, i) => `<vt:lpstr>${escapeXml(s.name || `Slide ${i + 1}`)}</vt:lpstr>`).join('')}`, 'the titles of parts');
    } else if (name === 'docProps/core.xml' && title) {
      x = once(x, /<dc:title>[^<]*<\/dc:title>/, `<dc:title>${escapeXml(title)}</dc:title>`, 'dc:title');
    }
    out.push({name, data: enc.encode(x)});
  }
  const slideRels = text('ppt/slides/_rels/slide1.xml.rels'), notes = text('ppt/notesSlides/notesSlide1.xml'), notesRels = text('ppt/notesSlides/_rels/notesSlide1.xml.rels');
  let media = 0;
  slides.forEach((s, i) => {
    const pics = s.pictures.map((p, k) => {
      media++;
      const {png, svg} = imageRids(k);
      out.push({name: `ppt/media/image${media}.png`, data: must(must(pngs[i])[k])}, {name: `ppt/media/image${media}.svg`, data: enc.encode(p.svg)});
      return `<Relationship Id="${png}" Type="${IMAGE_REL}" Target="../media/image${media}.png"/><Relationship Id="${svg}" Type="${IMAGE_REL}" Target="../media/image${media}.svg"/>`;
    }).join('');
    out.push(
      {name: `ppt/slides/slide${i + 1}.xml`, data: enc.encode(s.xml)},
      {name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: enc.encode(once(once(slideRels, 'notesSlide1.xml', `notesSlide${i + 1}.xml`, 'the notes relationship'), '</Relationships>', pics + '</Relationships>', 'Relationships'))},
      {name: `ppt/notesSlides/notesSlide${i + 1}.xml`, data: enc.encode(notesXml(notes, s.notes))},
      {name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, data: enc.encode(once(notesRels, 'slide1.xml', `slide${i + 1}.xml`, 'the slide of the notes'))},
    );
  });
  return out.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Every text of the slide that is measured, at its size and weight: for a shell that measures in a batch first (../../pptx-deck-diagram.ts). */
export function deckTexts(s: Omit<DeckSlideIn, 'figure'>): {text: string; size: number; bold: boolean}[] {
  return [
    ...(s.title ? [{text: s.title, size: STYLE.title.size, bold: STYLE.title.bold}] : []),
    ...(s.lead ? [{text: s.lead, size: STYLE.lead.size, bold: false}] : []),
    ...(s.source ? [{text: s.source, size: STYLE.source.size, bold: false}] : []),
    ...(s.callouts ?? []).map(c => ({text: (c.label ?? '') + c.text, size: STYLE.callout.size, bold: true})),
  ];
}
