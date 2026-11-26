// A deck of 16:9 slides as a .pptx package, as pure functions (ADR 0055). Each figure is one planSlide() (slide.ts), moved onto its slide
// and scaled there: positions, sizes, text, table rows and columns, insets and line widths are multiplied by the same factor, so the
// shapes stay native and editable and the text shrinks with them (PowerPoint does not scale text when a group is resized, so the figure
// is not one scaled group). Around it go the heading, the lead, the callouts and the source line; the notes go to the notes page.
// Measuring the text and drawing the PNGs are the shell's (../pptx-deck-edge.ts, ../../pptx-deck.ts).
import {escapeXml} from '../xml-escape.ts';
import {must} from '../must.ts';
import {planDeckLayout, roomMessage, SLIDE_H, SLIDE_W, smallTextWarning, type Block, type FigureFit, type Run, type TextWidth} from '../deck-layout.ts';
import type {Picture} from './image-band.ts';
import {imageRids, type Entry, type SlidePlan} from './package.ts';
import {TEMPLATE} from './template.ts';
import {attr, emu, sp, type Fonts} from './xml.ts';

// the layout is shared with the slide SVG of `serve` (ADR 0056 D2); these stay importable from here
export {deckTexts, MAX_FIGURE_SCALE, MIN_TEXT_PT, roomMessage, SLIDE_H, SLIDE_W, smallTextWarning, type TextWidth} from '../deck-layout.ts';

export interface DeckFigure {plan: SlidePlan; /** Its laid-out size, px. */ w: number; h: number}
/** A column of a slide (ADR 0058): its figure (laid out) or its text. */
export interface DeckColumnIn {caption?: string; figure?: DeckFigure; text?: string; width?: number}
export interface DeckSlideIn {title?: string; lead?: string; callouts?: {label?: string; text: string}[]; source?: string; notes?: string; figure?: DeckFigure; columns?: DeckColumnIn[]; columnScale?: 'each' | 'same'; /** ADR 0060; 'width' when not given. */ fit?: FigureFit; /** A cover (ADR 0066): no figure, columns or callouts. */ layout?: 'cover'; event?: string; date?: string; presenter?: string}
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
  /** The source wraps to too many lines (lib/deck-layout.ts SOURCE_MAX_LINES): the error to report, with noRoom. */
  sourceError?: string | null;
  /** How many lines the source wraps to. */
  sourceLines?: number;
  name: string;
  /** A cover (ADR 0066): its no-room message is its own. */
  cover?: boolean;
  /** Per column (ADR 0058): how much its figure was scaled and its smallest text after (null for a text column), and whether its content has no room. */
  columns?: {scale: number | null; minTextPt: number | null; noRoom: boolean}[];
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

/** A text block as a PowerPoint text box: exact line spacing of the block's pitch, no autofit. */
function textShape(id: number, b: Extract<Block, {kind: 'text'}>, fonts: Fonts): string {
  const rpr = (l: Run) => `<a:rPr lang="ja-JP" sz="${Math.round(b.size * 75)}" b="${l.bold ? 1 : 0}" kern="0" dirty="0"><a:solidFill><a:srgbClr val="${l.color}"/></a:solidFill><a:latin typeface="${attr(fonts.sans)}"/><a:ea typeface="${attr(fonts.sans)}"/></a:rPr>`;
  const body = b.lines.map((runs, i) => (i ? `<a:br>${rpr(must(runs[0]))}</a:br>` : '') + runs.map(r => `<a:r>${rpr(r)}<a:t>${escapeXml(r.text)}</a:t></a:r>`).join('')).join('');
  const h = b.lines.length * b.pitch + b.inset.y * 2;
  const spPr = `<a:xfrm><a:off x="${emu(b.x)}" y="${emu(b.y)}"/><a:ext cx="${emu(b.width)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>`;
  // a centred block (a cover, ADR 0066 D6) does not wrap again: a font a little wider than the measured one does not add a line
  const centre = b.align === 'center', noWrap = centre || b.wrap === 'none';
  const txBody = `<a:bodyPr wrap="${noWrap ? 'none' : 'square'}" lIns="${emu(b.inset.x)}" tIns="${emu(b.inset.y)}" rIns="${emu(b.inset.x)}" bIns="${emu(b.inset.y)}" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr${centre ? ' algn="ctr"' : ''}><a:lnSpc><a:spcPts val="${Math.round(b.pitch * 75)}"/></a:lnSpc></a:pPr>${body}</a:p>`;
  return sp(id, b.name, spPr, txBody);
}

const rectShape = (id: number, name: string, x: number, y: number, w: number, h: number, fill: string): string =>
  sp(id, name, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln>`,
    '<a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP" dirty="0"/></a:p>');

const blockShape = (id: number, b: Block, fonts: Fonts): string => b.kind === 'text' ? textShape(id, b, fonts) : rectShape(id, b.name, b.x, b.y, b.w, b.h, b.fill);

/** One slide: the heading and lead from the top, the source and callouts from the bottom, the figure scaled into what is left (lib/deck-layout.ts). */
export function planDeckSlide(s: DeckSlideIn, fonts: Fonts, w: TextWidth): PlannedSlide {
  if (s.columns?.length) return planColumnSlide(s, s.columns, fonts, w);
  const fig = s.figure;
  const layout = planDeckLayout(s, fig, w, undefined, 'each', s.fit ?? 'width');
  // the figure keeps its own shape ids (the connectors' glue names them); the slide's own shapes come after the largest
  let next = fig ? Math.max(1, ...[...fig.plan.xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => Number(m[1]))) : 1;
  const id = () => ++next;
  const top = layout.top.map(b => blockShape(id(), b, fonts));
  const bottom = layout.bottom.map(group => group.map(b => blockShape(id(), b, fonts)).join(''));
  let figureXml = '', scale: number | null = null, small: number | null = null;
  if (fig && layout.figure) {
    const {x: x0, y: y0, w: fw, h: fh, k} = layout.figure;
    const inner = must(/<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(fig.plan.xml))[1] ?? '';
    // a dark figure keeps its background as a panel behind it (the slide itself stays light)
    const bg = /<p:bg>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/.exec(fig.plan.xml)?.[1];
    figureXml = (bg ? rectShape(id(), 'figure background', x0, y0, fw, fh, bg) : '') + placeShapes(inner, k, emu(x0), emu(y0));
    scale = k;
    small = minTextPt(placeShapes(inner, k, 0, 0));
  }
  const name = s.title ?? fig?.plan.title ?? '';
  // drawn in this order: the heading and lead, the figure (its dark panel first), then the callouts and source on top
  const tree = top.join('') + figureXml + bottom.reverse().join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld${name ? ` name="${attr(name)}"` : ''}><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  return {xml, notes: s.notes ?? '', pictures: fig && !layout.noRoom ? fig.plan.pictures : [], scale, minTextPt: small, noRoom: layout.noRoom, sourceError: layout.sourceError, sourceLines: layout.sourceLines, name, columns: [], ...(s.layout === 'cover' ? {cover: true} : {})};
}

const slideXml = (name: string, tree: string): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld${name ? ` name="${attr(name)}"` : ''}><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

/**
 * A figure's shapes renumbered to sit beside other figures on one slide: shape ids (and the connectors' glue to them) moved up by `ids`,
 * picture relationships moved on by `pictures` places (imageRids).
 */
export function renumberShapes(xml: string, ids: number, pictures: number): string {
  if (!ids && !pictures) return xml;
  return xml
    .replace(/<p:cNvPr id="(\d+)"/g, (_m, n: string) => `<p:cNvPr id="${Number(n) + ids}"`)
    .replace(/<a:(stCxn|endCxn) id="(\d+)"/g, (_m, t: string, n: string) => `<a:${t} id="${Number(n) + ids}"`)
    .replace(/r:embed="rId(\d+)"/g, (m, n: string) => Number(n) >= 12 ? `r:embed="rId${Number(n) + 2 * pictures}"` : m);
}

/** A slide of columns (ADR 0058): each column's figure placed as the one figure of a slide is, its ids and pictures renumbered after the ones before. */
function planColumnSlide(s: DeckSlideIn, columns: DeckColumnIn[], fonts: Fonts, w: TextWidth): PlannedSlide {
  const layout = planDeckLayout(s, undefined, w, columns.map(c => ({caption: c.caption, figure: c.figure ? {w: c.figure.w, h: c.figure.h} : undefined, text: c.text, width: c.width})), s.columnScale, s.fit ?? 'width');
  let next = 1, pictureCount = 0;
  const pictures: Picture[] = [], stats: PlannedSlide['columns'] = [];
  const placed = columns.map((c, j) => {
    const place = layout.columns[j], fig = c.figure;
    if (!fig || !place?.figure) { stats.push({scale: null, minTextPt: null, noRoom: place?.noRoom ?? true}); return null; }
    const own = renumberShapes(fig.plan.xml, next - 1, pictureCount);
    next = Math.max(next, ...[...own.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => Number(m[1])));
    pictureCount += fig.plan.pictures.length;
    pictures.push(...fig.plan.pictures);
    const inner = must(/<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(own))[1] ?? '';
    const {x, y, w: fw, h: fh, k} = place.figure;
    const bg = /<p:bg>[\s\S]*?<a:srgbClr val="([0-9A-F]{6})"/.exec(fig.plan.xml)?.[1];
    stats.push({scale: k, minTextPt: minTextPt(placeShapes(inner, k, 0, 0)), noRoom: place.noRoom});
    return {bg, x, y, fw, fh, shapes: placeShapes(inner, k, emu(x), emu(y))};
  });
  const id = () => ++next;
  const top = layout.top.map(b => blockShape(id(), b, fonts));
  const figures = placed.map(p => p ? (p.bg ? rectShape(id(), 'figure background', p.x, p.y, p.fw, p.fh, p.bg) : '') + p.shapes : '');
  const texts = layout.columns.flatMap(c => [...(c.caption ? [c.caption] : []), ...c.text]).map(b => blockShape(id(), b, fonts));
  const bottom = layout.bottom.map(group => group.map(b => blockShape(id(), b, fonts)).join(''));
  const name = s.title ?? columns.find(c => c.figure)?.figure?.plan.title ?? '';
  const noRoom = layout.noRoom || stats.some(c => c.noRoom);
  return {xml: slideXml(name, top.join('') + figures.join('') + texts.join('') + bottom.reverse().join('')), notes: s.notes ?? '', pictures: noRoom ? [] : pictures, scale: null, minTextPt: null, noRoom, sourceError: layout.sourceError, sourceLines: layout.sourceLines, name, columns: stats};
}

const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const NOTES_CT = 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml';

/**
 * The notes page: one paragraph per line, blank lines kept as empty paragraphs (a break between thoughts), the leading and trailing blank lines dropped.
 * `<a:t>` takes no attributes (pml.xsd; unlike WordprocessingML's w:t, no xml:space): DrawingML keeps a run's spaces as they are, so an indent survives without it.
 */
function notesXml(template: string, notes: string): string {
  const lines = notes.replace(/\t/g, '    ').split(/\r\n|\r|\n/).map(l => l.trimEnd());
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const empty = '<a:p><a:endParaRPr lang="ja-JP" dirty="0"/></a:p>';
  const paras = lines.length ? lines.map(l => l ? `<a:p><a:r><a:rPr lang="ja-JP" dirty="0"/><a:t>${escapeXml(l)}</a:t></a:r></a:p>` : empty).join('') : empty;
  return once(template, /(<p:ph type="body" idx="1"\/>[\s\S]*?<a:lstStyle\/>)[\s\S]*?(<\/p:txBody>)/, (_m, a: string, b: string) => a + paras + b, 'the notes body');
}

/** `text` with `pattern` replaced, which must match: the template is fixed, so a miss means it changed and this code must follow it. */
function once(text: string, pattern: RegExp | string, to: string | ((...m: string[]) => string), what: string): string {
  const re = typeof pattern === 'string' ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')) : pattern;
  if (!re.test(text)) throw new Error(`deck: the pptx template no longer has ${what}`);
  return text.replace(re, to as never);
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
      // the schema's order is sldMasterIdLst, notesMasterIdLst, sldIdLst: the deck's slide list goes right after the notes master list
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

/**
 * What stops a planned slide (no room), and what it is warned about (small text), each with its place: the slide's figure, or each column's
 * (ADR 0058). `kinds`: what each column holds.
 */
export function slideIssues(p: PlannedSlide, i: number, hasFigure: boolean, kinds: readonly ('figure' | 'text')[] = []): {errors: {path: string; message: string}[]; warnings: {path: string; message: string}[]} {
  const errors: {path: string; message: string}[] = [], warnings: {path: string; message: string}[] = [];
  if (p.sourceError) return {errors: [{path: `slides[${i}].source`, message: p.sourceError}], warnings};
  if (!kinds.length) {
    if (p.noRoom) errors.push({path: `slides[${i}]`, message: roomMessage(hasFigure, p.cover)});
    else { const w = smallTextWarning(p); if (w) warnings.push({path: `slides[${i}].figure`, message: w}); }
    return {errors, warnings};
  }
  (p.columns ?? []).forEach((c, j) => {
    const at = `slides[${i}].columns[${j}]`;
    if (c.noRoom) errors.push(kinds[j] === 'text'
      ? {path: `${at}.text`, message: 'the text does not fit the column: shorten it, or give the column a larger width'}
      : {path: at, message: 'the heading, lead, callouts and source leave the column\'s figure no room: shorten them, or split the slide'});
    else { const w = smallTextWarning({...c, sourceLines: p.sourceLines}); if (w) warnings.push({path: `${at}.figure`, message: w}); }
  });
  if (p.noRoom && !errors.length) errors.push({path: `slides[${i}]`, message: roomMessage(true)});
  return {errors, warnings};
}
