// A deck (lib/deck-spec.ts) as one PowerPoint file of 16:9 slides, where there is no file system and no native code, such as a Cloudflare
// Worker ("svg-diagram/pptx/deck/edge", ADR 0055). Each figure is drawn as renderPptxEdge draws one (native shapes, pictures with a PNG
// fallback) and scaled onto its slide with the heading, lead, callouts, source and notes (lib/pptx/deck.ts).
import {capped} from './spec-validation.ts';
import type {SpecIssue} from './spec-kit.ts';
import {autoColumns, columnFallbackWarning, columnFigurePath, columnSpec, figurePath, fitOf, sharedColumns, type DeckSpec} from './deck-spec-core.ts';
import {chooseColumns, columnWidths, figureRooms, fillSearch, maxScale, ruleIds, type FigureFit} from './deck-layout.ts';
import {guardedEngine, type TextEngine} from './spec-edge-core.ts';
import {zipPackage, type FigurePlan, type PptxEdgeOptions} from './pptx-edge-core.ts';
import {deckEntries, minTextPt, placeShapes, planDeckSlide, slideIssues, type DeckFigure, type PlannedSlide, type TextWidth} from './pptx/deck.ts';
import {fontsOf} from './pptx/slide-core.ts';

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
export async function renderDeckPptxEdgeWith(input: unknown, givenEngine: TextEngine, opts: PptxEdgeOptions, services: {
  validate(input: unknown): SpecIssue[];
  plan(spec: unknown, engine: TextEngine): Promise<FigurePlan | {issues: SpecIssue[]}>;
}): Promise<DeckEdgeResult> {
  const pngScale = opts.pngScale ?? 2;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
  const invalid = services.validate(input);
  if (invalid.length) return none(invalid);
  const deck = input as DeckSpec, engine = guardedEngine(givenEngine), fonts = fontsOf(opts.font);
  const issues: SpecIssue[] = [];
  /** A figure planned as PowerPoint shapes: slide i's own, or its column j's (ADR 0058). */
  const fallbacks: SpecIssue[] = [];
  const width: TextWidth = (text, size, bold) => engine.textBox(text, 'sans', size, bold ? 700 : 400).w;
  const plan = async (i: number, spec: unknown, fit: FigureFit, room: {w: number; h: number} | null, j?: number, columnPx?: number): Promise<DeckFigure & {native: number} | undefined> => {
    if (spec === undefined) return undefined;
    const place = (p: string | null) => j === undefined ? figurePath(i, p) : columnFigurePath(i, j, p);
    // 'fill' (ADR 0060): a spec that gives no width of its own is laid out at the width that draws it largest in its room
    if (fit === 'fill' && room && typeof spec === 'object' && spec !== null && !Array.isArray(spec) && (spec as {width?: unknown}).width === undefined) {
      let firstIssues: SpecIssue[] = [];
      const found = await fillSearch(room, maxScale(fit), async w => {
        const f = await services.plan(w === null ? spec : {...spec, width: w}, engine);
        if ('issues' in f) { if (w === null) firstIssues = f.issues; return {ok: false, why: f.issues[0]?.message ?? ''}; }
        return {ok: true, w: f.width, h: f.height, value: f, flags: ruleIds(f.findings)};
      });
      if (!found.ok) { issues.push(...firstIssues.map(x => ({path: place(x.path), message: x.message}))); return undefined; }
      if (j !== undefined && found.width === null && found.narrower) fallbacks.push({path: place(''), message: columnFallbackWarning(found.narrower.width, found.narrower.why)});
      const f = found.value;
      return {plan: f.plan, w: f.width, h: f.height, native: f.native};
    }
    // a column's figure is laid out at the column's width when it gives none; when it does not fit there, at the document's (ADR 0059)
    const narrow = j !== undefined && columnPx !== undefined ? columnSpec(spec, columnPx) : {spec, auto: null};
    let f = await services.plan(narrow.spec, engine);
    if ('issues' in f && narrow.auto !== null) {
      const why = f.issues[0]?.message ?? '', wide = await services.plan(spec, engine);
      if (!('issues' in wide)) fallbacks.push({path: columnFigurePath(i, j as number, ''), message: columnFallbackWarning(narrow.auto, why)});
      f = wide;
    }
    if ('issues' in f) { issues.push(...f.issues.map(x => ({path: j === undefined ? figurePath(i, x.path) : columnFigurePath(i, j, x.path), message: x.message}))); return undefined; }
    return {plan: f.plan, w: f.width, h: f.height, native: f.native};
  };
  const figures: (DeckFigure & {native: number} | undefined)[] = [], columnFigures: (DeckFigure & {native: number} | undefined)[][] = [], shares: (number[] | undefined)[] = [];
  for (const [i, s] of deck.slides.entries()) {
    const fit = fitOf(deck, s);
    if (s.columns && autoColumns(deck, s)) {
      // the columns' shares chosen from what they hold (ADR 0061)
      const columns = s.columns;
      const chosen = await chooseColumns({...s, columns}, width, maxScale(fit), async (j, w) => {
        const spec = columns[j]?.figure;
        const searchable = typeof spec === 'object' && spec !== null && !Array.isArray(spec) && (spec as {width?: unknown}).width === undefined;
        if (w !== null && !searchable) return {ok: false, why: 'the figure has a width of its own'};
        const f = await services.plan(w === null ? spec : {...(spec as object), width: w}, engine);
        if ('issues' in f) { if (w === null) issues.push(...f.issues.map(x => ({path: columnFigurePath(i, j, x.path), message: x.message}))); return {ok: false, why: f.issues[0]?.message ?? ''}; }
        const inner = /<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(f.plan.xml)?.[1] ?? '';
        return {ok: true, w: f.width, h: f.height, value: f, flags: ruleIds(f.findings), minPt: minTextPt(placeShapes(inner, 1, 0, 0))};
      });
      if (!chosen.ok) { if (!issues.length) issues.push({path: `slides[${i}].columns`, message: chosen.why}); figures.push(undefined); columnFigures.push([]); shares.push(undefined); continue; }
      figures.push(undefined);
      columnFigures.push(chosen.figures.map(f => f ? {plan: f.value.plan, w: f.value.width, h: f.value.height, native: f.value.native} : undefined));
      shares.push(chosen.shares);
      continue;
    }
    const cols0 = s.columns ? sharedColumns(s.columns) : undefined, rooms = figureRooms({...s, columns: cols0}, width);
    figures.push(await plan(i, s.figure, fit, rooms.figure));
    const cols: (DeckFigure & {native: number} | undefined)[] = [];
    const px = columnWidths(cols0 ?? []);
    for (const [j, c] of (s.columns ?? []).entries()) cols.push(await plan(i, c.figure, fit, rooms.columns[j] ?? null, j, px[j]));
    columnFigures.push(cols);
    shares.push(undefined);
  }
  if (issues.length) return none(issues);
  const planned: PlannedSlide[] = deck.slides.map(({figure: _spec, columns, ...s}, i) => {
    const f = figures[i];
    const cols = columns && sharedColumns(columns, shares[i]).map((c, j) => ({caption: c.caption, text: c.text, width: c.width, figure: columnFigures[i]?.[j]}));
    return planDeckSlide({...s, fit: fitOf(deck, deck.slides[i] ?? {}), ...(f ? {figure: f} : {}), ...(cols ? {columns: cols} : {})}, fonts, width);
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
