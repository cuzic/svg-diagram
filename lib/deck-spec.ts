// A deck: slides of 16:9, each with a heading, a lead, a figure (a JSON spec, lib/spec.ts), callouts, a source line and speaker notes
// (ADR 0055). The input, its JSON Schema and its checks, with places such as `slides[2].figure.parts[0].nodes[1]`. Like lib/spec.ts, nothing
// here touches the disk or a process.
import {capped, specSchema, validateAgainst, validateSpec} from './spec.ts';
import {count, list, object, oneOf, SPEC_WIDTH, text, type Json, type JsonSchema, type SpecIssue} from './spec-kit.ts';
import {columnLayoutWidth} from './deck-layout.ts';

/** Slides in one deck (ADR 0055 D1, raised from 30 to 300 on 2026-11-15: see the ADR for what the number rests on). */
export const MAX_SLIDES = 300;
export const MAX_CALLOUTS = 3;
/** Columns of a slide (ADR 0058). */
export const MIN_COLUMNS = 2, MAX_COLUMNS = 3;

export interface DeckCallout {label?: string; text: string}
/** One column of a slide (ADR 0058): a figure or short text, under an optional caption, `width` its share of the row. */
export interface DeckColumn {caption?: string; figure?: unknown; text?: string; width?: number}
export interface DeckSlide {title?: string; lead?: string; figure?: unknown; columns?: DeckColumn[]; columnScale?: 'each' | 'same'; fit?: 'fill' | 'width'; callouts?: DeckCallout[]; source?: string; notes?: string}
export interface DeckSpec {title?: string; fit?: 'fill' | 'width'; slides: DeckSlide[]}

/** How slide i's figures take its room (ADR 0060): the slide's `fit`, else the deck's, else 'fill'. */
export const fitOf = (deck: DeckSpec, slide: DeckSlide): 'fill' | 'width' => slide.fit ?? deck.fit ?? 'fill';

const slideShape = (figure: JsonSchema): JsonSchema => object({
  title: text('The slide heading, drawn large at the top.', 120),
  lead: text('One or two sentences under the heading: what the slide says.', 300),
  figure,
  columns: list(object({
    caption: text('A small bold heading over the column, one line.', 60),
    figure: {...figure, description: 'The column\'s figure (a JSON spec). Write either figure or text.'},
    text: text('Short text for the column: lines separated by "\\n"; a line starting with ・ or "- " is a bullet. Write either figure or text.', 600),
    width: count('The column\'s share of the row (1 to 3, default 1).', 3),
  }, [], 'One column: a figure or short text.'), MAX_COLUMNS, MIN_COLUMNS),
  columnScale: {...oneOf('each', 'same'), description: '"each" (default): each column\'s figure as large as it fits; "same": every figure at one scale (to compare a before and an after).'},
  fit: {...oneOf('fill', 'width'), description: 'How the figures take the room the slide leaves: "fill" (default) lays each out at the width that draws it largest (up to 1.5 times), so little room is left empty; "width" keeps each at its own width (or its column\'s) and scales it up to 1.25 times.'},
  callouts: list(object({
    label: text('Plain words before the emphasised text, such as 「足す一文：」.', 60),
    text: text('The emphasised text, drawn bold in a tinted box near the bottom of the slide.', 300),
  }, ['text']), MAX_CALLOUTS),
  source: text('Where the facts come from, drawn small at the bottom.', 300),
  notes: text('Speaker notes. Lines are separated by "\\n".', 5000),
}, [], 'One 16:9 slide. Every field is optional, but a slide needs a title, a figure or columns. figure and columns do not go together.');

const FIGURE: JsonSchema = {...specSchema, description: 'The figure: the same JSON spec as a single diagram. It is laid out at its own size and then scaled to the room the slide leaves.'};

/** The deck's JSON Schema, figures included (each is a full spec). */
export const deckSchema: JsonSchema = object({
  title: text('The file\'s title (the presentation\'s properties).', 200),
  fit: {...oneOf('fill', 'width'), description: 'How the figures take the room the slide leaves: "fill" (default) lays each out at the width that draws it largest (up to 1.5 times), so little room is left empty; "width" keeps each at its own width (or its column\'s) and scales it up to 1.25 times.'},
  slides: list(slideShape(FIGURE), MAX_SLIDES, 1),
}, ['slides'], 'A PowerPoint deck of 16:9 slides.');

// the same shape with the figure left to validateSpec, so that a figure's mistakes come back once, with the part rules too
const SHAPE: JsonSchema = object({title: deckSchema.properties?.['title'] as JsonSchema, fit: deckSchema.properties?.['fit'] as JsonSchema, slides: list(slideShape({description: 'figure'}), MAX_SLIDES, 1)}, ['slides']);
// notes is the one field with line breaks (and tabs, for indented points): the schema's check forbids control characters, so it is checked with them taken out
const NOTES_BREAKS = /\r\n|\r|\n/g;

/** Where a figure's issue is in the deck: `slides[i].figure` and then the spec's own path ('' is the whole figure). */
export const figurePath = (i: number, path: string | null): string => `slides[${i}].figure${path ? `.${path}` : ''}`;

/** Where a column figure's issue is: `slides[i].columns[j].figure` and then the spec's own path. */
export const columnFigurePath = (i: number, j: number, path: string | null): string => `slides[${i}].columns[${j}].figure${path ? `.${path}` : ''}`;

/** Every problem with `input`, each with its place; empty when it can be drawn. At most MAX_ISSUES (the last says how many more). */
export function validateDeck(input: unknown): SpecIssue[] {
  const flat = withoutBreaks(input);
  const issues = validateAgainst(SHAPE, flat);
  const slides = (flat as Json | null)?.['slides'];
  if (Array.isArray(slides)) slides.forEach((s: unknown, i) => {
    if (typeof s !== 'object' || s === null) return;
    const slide = s as Json;
    if (slide['title'] === undefined && slide['figure'] === undefined && slide['columns'] === undefined) issues.push({path: `slides[${i}]`, message: 'needs a title, a figure or columns'});
    if (slide['figure'] !== undefined && slide['columns'] !== undefined) issues.push({path: `slides[${i}]`, message: 'has both figure and columns: write one of them (put the figure in a column)'});
    if (slide['figure'] !== undefined) for (const f of validateSpec(slide['figure'])) issues.push({path: figurePath(i, f.path), message: f.message});
    const columns = slide['columns'];
    if (Array.isArray(columns)) columns.forEach((c: unknown, j) => {
      if (typeof c !== 'object' || c === null) return;
      const col = c as Json, has = (k: string) => col[k] !== undefined;
      if (has('figure') === has('text')) issues.push({path: `slides[${i}].columns[${j}]`, message: has('figure') ? 'has both figure and text: write one of them' : 'needs a figure or text'});
      if (has('figure')) for (const f of validateSpec(col['figure'])) issues.push({path: columnFigurePath(i, j, f.path), message: f.message});
    });
  });
  return capped(issues);
}

/** The input with the line breaks of every slide's notes and column texts replaced by spaces (only for checking). */
function withoutBreaks(input: unknown): unknown {
  const slides = (input as Json | null)?.['slides'];
  if (!Array.isArray(slides)) return input;
  const flat = (v: unknown): unknown => typeof v === 'string' ? v.replace(NOTES_BREAKS, ' ').replace(/\t/g, ' ') : v;
  return {...(input as Json), slides: slides.map((s: unknown) => {
    if (typeof s !== 'object' || s === null) return s;
    const slide = s as Json, out: Json = {...slide};
    if (typeof slide['notes'] === 'string') out['notes'] = flat(slide['notes']);
    if (Array.isArray(slide['columns'])) out['columns'] = slide['columns'].map((c: unknown) => typeof c === 'object' && c !== null && typeof (c as Json)['text'] === 'string' ? {...(c as Json), text: flat((c as Json)['text'])} : c);
    return out;
  })};
}

/**
 * The spec a column's figure is laid out from (ADR 0059): one that gives no `width` of its own is laid out at the column's width (so its
 * boxes and tables wrap their text instead of the whole figure being shrunk); `auto` is that width, or null when the spec keeps its own.
 */
export function columnSpec(spec: unknown, columnPx: number): {spec: unknown; auto: number | null} {
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec) || (spec as Json)['width'] !== undefined) return {spec, auto: null};
  const auto = columnLayoutWidth(columnPx, SPEC_WIDTH);
  return auto >= SPEC_WIDTH.max ? {spec, auto: null} : {spec: {...(spec as Json), width: auto}, auto};
}

/** The warning when a column's figure did not fit its column's width and was drawn at the document's width and shrunk instead (ADR 0059). */
export const columnFallbackWarning = (auto: number, why: string): string =>
  `does not fit the column's ${auto}px (${why.split('\n')[0]?.slice(0, 160)}); drawn at ${SPEC_WIDTH.max}px and shrunk instead: give the column a larger width, fewer words, or a layout that fits, or write the figure's own width`;
