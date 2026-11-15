// A deck (lib/deck-spec.ts) as one PowerPoint file of 16:9 slides, where there is no file system and no native code, such as a Cloudflare
// Worker ("svg-diagram/pptx/deck/edge", ADR 0055). Each figure is drawn as renderPptxEdge draws one (native shapes, pictures with a PNG
// fallback) and scaled onto its slide with the heading, lead, callouts, source and notes (lib/pptx/deck.ts).
import {capped, type SpecIssue} from './spec.ts';
import {figurePath, validateDeck, type DeckSpec} from './deck-spec.ts';
import {guardedEngine, type TextEngine} from './spec-edge.ts';
import {planFigureEdge, zipPackage, type PptxEdgeOptions} from './pptx-edge.ts';
import {deckEntries, planDeckSlide, roomMessage, smallTextWarning, type DeckFigure, type PlannedSlide, type TextWidth} from './pptx/deck.ts';
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
  const figures: (DeckFigure & {native: number} | undefined)[] = [];
  const issues: SpecIssue[] = [];
  for (const [i, s] of deck.slides.entries()) {
    if (s.figure === undefined) { figures.push(undefined); continue; }
    const f = await planFigureEdge(s.figure, engine, opts);
    if ('issues' in f) { issues.push(...f.issues.map(x => ({path: figurePath(i, x.path), message: x.message}))); figures.push(undefined); }
    else figures.push({plan: f.plan, w: f.width, h: f.height, native: f.native});
  }
  if (issues.length) return none(issues);
  const width: TextWidth = (text, size, bold) => engine.textBox(text, 'sans', size, bold ? 700 : 400).w;
  const planned: PlannedSlide[] = deck.slides.map(({figure: _spec, ...s}, i) => { const f = figures[i]; return planDeckSlide(f ? {...s, figure: f} : s, fonts, width); });
  const warnings: SpecIssue[] = [];
  planned.forEach((p, i) => {
    const small = smallTextWarning(p);
    if (p.noRoom) issues.push({path: `slides[${i}]`, message: roomMessage(figures[i] !== undefined)});
    else if (small) warnings.push({path: figurePath(i, ''), message: small});
  });
  if (issues.length) return none(issues);
  const pngs: Uint8Array[][] = [];
  for (const p of planned) {
    const list: Uint8Array[] = [];
    for (const pic of p.pictures) list.push(await opts.rasterize(pic.pngSvg, pngScale));
    pngs.push(list);
  }
  const pptx = await zipPackage(deckEntries(planned, pngs, deck.title));
  return {pptx, issues: [], warnings: capped(warnings), slides: planned.map((p, i) => ({scale: p.scale, minTextPt: p.minTextPt, native: figures[i]?.native ?? 0, pictures: p.pictures.length}))};
}
