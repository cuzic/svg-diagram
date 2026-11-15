// A deck (lib/deck-spec.ts) as one PowerPoint file of 16:9 slides, where there is no file system and no native code, such as a Cloudflare
// Worker ("svg-diagram/pptx/deck/edge", ADR 0055). Each figure is drawn as renderPptxEdge draws one (native shapes, pictures with a PNG
// fallback) and scaled onto its slide with the heading, lead, callouts, source and notes (lib/pptx/deck.ts).
import {capped, type SpecIssue} from './spec.ts';
import {columnFallbackWarning, columnFigurePath, columnSpec, figurePath, validateDeck, type DeckSpec} from './deck-spec.ts';
import {columnWidths} from './deck-layout.ts';
import {guardedEngine, type TextEngine} from './spec-edge.ts';
import {planFigureEdge, zipPackage, type PptxEdgeOptions} from './pptx-edge.ts';
import {deckEntries, planDeckSlide, slideIssues, type DeckFigure, type PlannedSlide, type TextWidth} from './pptx/deck.ts';
import {fontsOf} from './pptx/slide.ts';

export type {TextEngine} from './spec-edge.ts';
export {TextEngineError} from './spec-edge.ts';
export {deckSchema, validateDeck, MAX_SLIDES, type DeckSpec, type DeckSlide} from './deck-spec.ts';

export type DeckEdgeOptions = PptxEdgeOptions;

export interface DeckSlideResult {
  /** How much the figure was scaled onto the slide, and its smallest text after (pt); null without a figure. */
  scale: number | null;
  minTextPt: number | null;
  /** Bands that became native shapes, and pictures. */
  native: number;
  pictures: number;
  /** Per column (ADR 0058): its figure's scale and smallest text (null for a text column). */
  columns: {scale: number | null; minTextPt: number | null}[];
}

export interface DeckEdgeResult {
  /** The .pptx file, or null when the deck could not be used or a figure could not be laid out. */
  pptx: Uint8Array | null;
  /** Why there is no file, with places such as `slides[1].figure.parts[0].nodes[2]`. */
  issues: SpecIssue[];
  /** The file is made, but a slide may be hard to read (a figure scaled until its text is small). */
  warnings: SpecIssue[];
  slides: DeckSlideResult[];
}

const none = (issues: SpecIssue[]): DeckEdgeResult => ({pptx: null, issues: capped(issues), warnings: [], slides: []});

/**
 * The deck as a .pptx. A bad deck, a figure that cannot be laid out or a slide with no room for its figure comes back as issues; a failure of
 * the engine throws TextEngineError, and one of `rasterize` throws as it is. Each figure's own checks are renderSpecEdge's: run that first.
 */
export async function renderDeckPptxEdge(input: unknown, givenEngine: TextEngine, opts: DeckEdgeOptions): Promise<DeckEdgeResult> {
  const pngScale = opts.pngScale ?? 2;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
  const invalid = validateDeck(input);
  if (invalid.length) return none(invalid);
  const deck = input as DeckSpec, engine = guardedEngine(givenEngine), fonts = fontsOf(opts.font);
  const issues: SpecIssue[] = [];
  /** A figure planned as PowerPoint shapes: slide i's own, or its column j's (ADR 0058). */
  const fallbacks: SpecIssue[] = [];
  const plan = async (i: number, spec: unknown, j?: number, columnPx?: number): Promise<DeckFigure & {native: number} | undefined> => {
    if (spec === undefined) return undefined;
    // a column's figure is laid out at the column's width when it gives none; when it does not fit there, at the document's (ADR 0059)
    const narrow = j !== undefined && columnPx !== undefined ? columnSpec(spec, columnPx) : {spec, auto: null};
    let f = await planFigureEdge(narrow.spec, engine, opts);
    if ('issues' in f && narrow.auto !== null) {
      const why = f.issues[0]?.message ?? '', wide = await planFigureEdge(spec, engine, opts);
      if (!('issues' in wide)) fallbacks.push({path: columnFigurePath(i, j as number, ''), message: columnFallbackWarning(narrow.auto, why)});
      f = wide;
    }
    if ('issues' in f) { issues.push(...f.issues.map(x => ({path: j === undefined ? figurePath(i, x.path) : columnFigurePath(i, j, x.path), message: x.message}))); return undefined; }
    return {plan: f.plan, w: f.width, h: f.height, native: f.native};
  };
  const figures: (DeckFigure & {native: number} | undefined)[] = [], columnFigures: (DeckFigure & {native: number} | undefined)[][] = [];
  for (const [i, s] of deck.slides.entries()) {
    figures.push(await plan(i, s.figure));
    const cols: (DeckFigure & {native: number} | undefined)[] = [];
    const px = columnWidths(s.columns ?? []);
    for (const [j, c] of (s.columns ?? []).entries()) cols.push(await plan(i, c.figure, j, px[j]));
    columnFigures.push(cols);
  }
  if (issues.length) return none(issues);
  const width: TextWidth = (text, size, bold) => engine.textBox(text, 'sans', size, bold ? 700 : 400).w;
  const planned: PlannedSlide[] = deck.slides.map(({figure: _spec, columns, ...s}, i) => {
    const f = figures[i];
    const cols = columns?.map((c, j) => ({caption: c.caption, text: c.text, width: c.width, figure: columnFigures[i]?.[j]}));
    return planDeckSlide({...s, ...(f ? {figure: f} : {}), ...(cols ? {columns: cols} : {})}, fonts, width);
  });
  const warnings: SpecIssue[] = [...fallbacks];
  planned.forEach((p, i) => {
    const r = slideIssues(p, i, figures[i] !== undefined, (deck.slides[i]?.columns ?? []).map(c => c.text === undefined ? 'figure' : 'text'));
    issues.push(...r.errors);
    warnings.push(...r.warnings);
  });
  if (issues.length) return none(issues);
  const pngs: Uint8Array[][] = [];
  for (const p of planned) {
    const list: Uint8Array[] = [];
    for (const pic of p.pictures) list.push(await opts.rasterize(pic.pngSvg, pngScale));
    pngs.push(list);
  }
  const pptx = await zipPackage(deckEntries(planned, pngs, deck.title));
  return {pptx, issues: [], warnings: capped(warnings), slides: planned.map((p, i) => ({scale: p.scale, minTextPt: p.minTextPt, native: (figures[i]?.native ?? 0) + (columnFigures[i] ?? []).reduce((n, f) => n + (f?.native ?? 0), 0), pictures: p.pictures.length, columns: (p.columns ?? []).map(c => ({scale: c.scale, minTextPt: c.minTextPt}))}))};
}
