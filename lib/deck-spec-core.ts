// A deck: slides of 16:9, each with a heading, a lead, a figure (a JSON spec, lib/spec.ts), callouts, a source line and speaker notes
// (ADR 0055), or a cover (ADR 0066). The input, its JSON Schema and its checks, with places such as `slides[2].figure.parts[0].nodes[1]`. Like lib/spec.ts, nothing
// here touches the disk or a process.
import {capped, validateAgainst} from './spec-validation.ts';
import {count, list, object, oneOf, SPEC_WIDTH, text, withoutSchemaField, type Json, type JsonSchema, type SpecIssue} from './spec-kit.ts';
import {columnLayoutWidth} from './deck-layout.ts';

/** Slides in one deck (ADR 0055 D1, raised from 30 to 300 on 2026-11-15: see the ADR for what the number rests on). */
export const MAX_SLIDES = 300;
export const MAX_CALLOUTS = 3;
/** Columns of a slide (ADR 0058). */
export const MIN_COLUMNS = 2, MAX_COLUMNS = 3;

export interface DeckCallout {label?: string; text: string}
/** One column of a slide (ADR 0058): a figure or short text, under an optional caption, `width` its share of the row. */
export interface DeckColumn {caption?: string; figure?: unknown; text?: string; /** Its share of the row (1 to 3), or 'auto' (ADR 0061; leaving it out is 'auto' too). */ width?: number | 'auto'}
export interface DeckSlide {title?: string; lead?: string; figure?: unknown; columns?: DeckColumn[]; columnScale?: 'each' | 'same'; fit?: 'fill' | 'width'; callouts?: DeckCallout[]; source?: string; notes?: string; /** ADR 0066: a cover, and the fields only a cover has. */ layout?: 'cover'; event?: string; date?: string; presenter?: string}

/** The fields a cover does not draw (ADR 0066 D2), and the ones only a cover draws. */
export const NOT_ON_COVER = ['figure', 'columns', 'columnScale', 'fit', 'callouts'] as const;
export const COVER_ONLY = ['event', 'date', 'presenter'] as const;
/** The message for a field a cover does not draw. */
export const notOnCover = (field: string): string => `is not drawn on a cover (layout "cover"): put the ${field} on a slide of its own, or take "layout" out`;
export interface DeckSpec {title?: string; fit?: 'fill' | 'width'; slides: DeckSlide[]}

/** How slide i's figures take its room (ADR 0060): the slide's `fit`, else the deck's, else 'fill'. */
export const fitOf = (deck: DeckSpec, slide: DeckSlide): 'fill' | 'width' => slide.fit ?? deck.fit ?? 'fill';

const slideShape = (figure: JsonSchema): JsonSchema => object({
  layout: {...oneOf('cover'), description: '"cover": a cover (title slide): the event, title, lead (as the subtitle), date and presenter, large and centred. A cover needs a title and has no figure, columns, columnScale, fit or callouts. Leave it out for an ordinary slide.'},
  title: text('The slide heading, drawn large at the top (on a cover: the title, large and centred).', 120),
  lead: text('One or two sentences under the heading: what the slide says (on a cover: the subtitle).', 300),
  event: text('Cover only: the event or series, such as 「第2回 AI開発の進め方 勉強会」, above the title.', 80),
  date: text('Cover only: the date, drawn as written (any form, such as 「2026年11月27日」 or "2026-11-27").', 60),
  presenter: text('Cover only: who presents, drawn as written (an affiliation or several names in this one text).', 120),
  figure,
  columns: {...list(object({
    caption: text('A small bold heading over the column, one line.', 60),
    figure: {...figure, description: 'The column\'s figure (a JSON spec). Write either figure or text.'},
    text: text('Short text for the column: lines separated by "\\n"; a line starting with ・ or "- " is a bullet. Write either figure or text.', 600),
    width: {oneOf: [count('The column\'s share of the row (1 to 3).', 3), {type: 'string', const: 'auto'}], description: 'The column\'s share of the row: 1 to 3, or "auto" (the default): when every column is auto, the shares are chosen to leave the least empty room on the slide with every text at 9pt or more (fit "width": equal shares).'},
  }, [], 'One column: a figure or short text.'), MAX_COLUMNS, MIN_COLUMNS), description: 'Two or three columns side by side, in place of the figure. Not on a cover.'},
  columnScale: {...oneOf('each', 'same'), description: '"each" (default): each column\'s figure as large as it fits; "same": every figure at one scale (to compare a before and an after). Not on a cover.'},
  fit: {...oneOf('fill', 'width'), description: 'How the figures take the room the slide leaves: "fill" (default) lays each out at the width that draws it largest (up to 1.5 times), so little room is left empty; "width" keeps each at its own width (or its column\'s) and scales it up to 1.25 times. Not on a cover.'},
  callouts: {...list(object({
    label: text('Plain words before the emphasised text, such as 「足す一文：」.', 60),
    text: text('The emphasised text, drawn bold in a tinted box near the bottom of the slide.', 300),
  }, ['text']), MAX_CALLOUTS), description: 'Up to three emphasised lines near the bottom of the slide. Not on a cover.'},
  source: text('Where the facts come from, drawn small at the bottom.', 300),
  notes: text('Speaker notes. Lines are separated by "\\n".', 5000),
}, [], 'One 16:9 slide. Every field is optional, but a slide needs a title, a figure or columns. figure and columns do not go together. With "layout": "cover" it is a cover: title (required), lead, event, date, presenter, source and notes only.');

export const deckSchemaFor = (figure: JsonSchema): JsonSchema => object({
  title: text('The file\'s title (the presentation\'s properties).', 200),
  fit: {...oneOf('fill', 'width'), description: 'How the figures take the room the slide leaves: "fill" (default) lays each out at the width that draws it largest (up to 1.5 times), so little room is left empty; "width" keeps each at its own width (or its column\'s) and scales it up to 1.25 times.'},
  slides: list(slideShape(figure), MAX_SLIDES, 1),
}, ['slides'], 'A PowerPoint deck of 16:9 slides. A cover is a slide with "layout": "cover".');

// Figure validation uses its own schema, so deck checks report its issues only once.
const SHAPE = /* @__PURE__ */ deckSchemaFor({description: 'figure'});
// notes is the one field with line breaks (and tabs, for indented points): the schema's check forbids control characters, so it is checked with them taken out
const NOTES_BREAKS = /\r\n|\r|\n/g;

/** Where a figure's issue is in the deck: `slides[i].figure` and then the spec's own path ('' is the whole figure). */
export const figurePath = (i: number, path: string | null): string => `slides[${i}].figure${path ? `.${path}` : ''}`;

/**
 * A figure's problems (its verdict's `problems`: what `build` and `check` stop at) as a deck's messages (ADR 0056): one summary line, then each problem's own message
 * (a problem may name its rule `[rule-id]`; not all do). `accept` does not reach problems (ADR 0024), here as in `check`.
 */
export const figureProblemMessages = (problems: readonly string[]): string[] => problems.length === 0 ? [] :
  [`${problems.length} 個の問題があるので、このスライドを描かない(図を直す。\`svg-diagram check\` で同じ問題が見える)`, ...problems];
export const figureProblemErrors = (place: string, problems: readonly string[]): string[] => figureProblemMessages(problems).map(m => `${place}: ${m}`);

/** Where a column figure's issue is: `slides[i].columns[j].figure` and then the spec's own path. */
export const columnFigurePath = (i: number, j: number, path: string | null): string => `slides[${i}].columns[${j}].figure${path ? `.${path}` : ''}`;

/** Every problem with `input`, each with its place; empty when it can be drawn. At most MAX_ISSUES (the last says how many more). */
export function validateDeckWith(input: unknown, validateFigure: (figure: unknown) => SpecIssue[]): SpecIssue[] {
  return capped(deckIssues(input, (figure, at) => validateFigure(figure).map(f => ({path: at(f.path), message: f.message}))).flat());
}

/** Use asynchronously loaded figure validators while retaining the deck's issue order. */
export async function validateDeckWithAsync(input: unknown, validateFigure: (figure: unknown) => Promise<SpecIssue[]>): Promise<SpecIssue[]> {
  const issues = deckIssues(input, async (figure, at) => (await validateFigure(figure)).map(f => ({path: at(f.path), message: f.message})));
  return capped((await Promise.all(issues)).flat());
}

type FigureLocation = (path: string | null) => string;

function deckIssues<T>(input: unknown, validateFigure: (figure: unknown, at: FigureLocation) => T): (SpecIssue | T)[] {
  const flat = withoutBreaks(withoutSchemaField(input)); // a deck file names its schema for the editor (ADR 0071)
  const issues: (SpecIssue | T)[] = validateAgainst(SHAPE, flat);
  const slides = (flat as Json | null)?.['slides'];
  if (Array.isArray(slides)) slides.forEach((s: unknown, i) => {
    if (typeof s !== 'object' || s === null) return;
    const slide = s as Json;
    if (slide['layout'] === 'cover') {
      // a cover (ADR 0066 D2): its title is required, and what it does not draw is a mistake where it is written
      if (slide['title'] === undefined) issues.push({path: `slides[${i}].title`, message: 'a cover needs a title'});
      for (const k of NOT_ON_COVER) if (slide[k] !== undefined) issues.push({path: `slides[${i}].${k}`, message: notOnCover(k)});
      return;
    }
    if (slide['layout'] === undefined) for (const k of COVER_ONLY) if (slide[k] !== undefined) issues.push({path: `slides[${i}].${k}`, message: 'is drawn only on a cover: add "layout": "cover" to the slide, or take it out'});
    if (slide['title'] === undefined && slide['figure'] === undefined && slide['columns'] === undefined) issues.push({path: `slides[${i}]`, message: 'needs a title, a figure or columns'});
    if (slide['figure'] !== undefined && slide['columns'] !== undefined) issues.push({path: `slides[${i}]`, message: 'has both figure and columns: write one of them (put the figure in a column)'});
    if (slide['figure'] !== undefined) checkFigure(slide['figure'], path => figurePath(i, path), issues, validateFigure);
    const columns = slide['columns'];
    if (Array.isArray(columns)) columns.forEach((c: unknown, j) => {
      if (typeof c !== 'object' || c === null) return;
      const col = c as Json, has = (k: string) => col[k] !== undefined;
      if (has('figure') === has('text')) issues.push({path: `slides[${i}].columns[${j}]`, message: has('figure') ? 'has both figure and text: write one of them' : 'needs a figure or text'});
      if (has('figure')) checkFigure(col['figure'], path => columnFigurePath(i, j, path), issues, validateFigure);
    });
  });
  return issues;
}

/**
 * A slide's or a column's figure, its issues placed by `at`. A deck slide sizes its figure to the room it leaves (a column's figure to its
 * column, ADR 0059); a canvas is a whole slide of its own, so the two cannot both decide. Said once, not with the canvas's own mistakes,
 * and the rest of the figure is checked without it, so a bad canvas does not hide its other mistakes.
 */
function checkFigure<T>(figure: unknown, at: FigureLocation, issues: (SpecIssue | T)[], validateFigure: (figure: unknown, at: FigureLocation) => T): void {
  const canvas = typeof figure === 'object' && figure !== null && !Array.isArray(figure) && Object.hasOwn(figure, 'canvas');
  if (canvas) issues.push({path: at('canvas'), message: 'is for a figure drawn alone: a deck slide sizes its figure to the room left on the slide (leave canvas out)'});
  const {canvas: _refused, ...rest} = canvas ? figure as Json : {};
  issues.push(validateFigure(canvas ? rest : figure, at));
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

/** The columns' shares as written: a number where one is given, null where it is left to choice ('auto' or left out). */
export const writtenShares = (columns: readonly DeckColumn[]): (number | null)[] => columns.map(c => typeof c.width === 'number' ? c.width : null);
/** Whether slide's columns are chosen (ADR 0061): every column 'auto' and the slide fills. Otherwise an 'auto' column takes 1. */
export const autoColumns = (deck: DeckSpec, slide: DeckSlide): boolean => !!slide.columns?.length && fitOf(deck, slide) === 'fill' && writtenShares(slide.columns).every(w => w === null);
/** The columns with the shares to lay them out by: chosen ones where given, else the written ones ('auto' as 1). */
export const sharedColumns = <C extends DeckColumn>(columns: readonly C[], chosen?: readonly number[]): (Omit<C, 'width'> & {width: number})[] =>
  columns.map((c, j) => ({...c, width: chosen?.[j] ?? (typeof c.width === 'number' ? c.width : 1)}));
