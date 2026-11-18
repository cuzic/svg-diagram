// A deck: slides of 16:9, each with a heading, a lead, a figure (a JSON spec, lib/spec.ts), callouts, a source line and speaker notes
// (ADR 0055), or a cover (ADR 0066). The input, its JSON Schema and its checks, with places such as `slides[2].figure.parts[0].nodes[1]`. Like lib/spec.ts, nothing
// here touches the disk or a process.
import { capped, specSchema, validateAgainst, validateSpec } from './spec.js';
import { count, list, object, oneOf, SPEC_WIDTH, text } from './spec-kit.js';
import { columnLayoutWidth } from './deck-layout.js';
/** Slides in one deck (ADR 0055 D1, raised from 30 to 300 on 2026-11-15: see the ADR for what the number rests on). */
export const MAX_SLIDES = 300;
export const MAX_CALLOUTS = 3;
/** Columns of a slide (ADR 0058). */
export const MIN_COLUMNS = 2, MAX_COLUMNS = 3;
/** The fields a cover does not draw (ADR 0066 D2), and the ones only a cover draws. */
export const NOT_ON_COVER = ['figure', 'columns', 'columnScale', 'fit', 'callouts'];
export const COVER_ONLY = ['event', 'date', 'presenter'];
/** The message for a field a cover does not draw. */
export const notOnCover = (field) => `is not drawn on a cover (layout "cover"): put the ${field} on a slide of its own, or take "layout" out`;
/** How slide i's figures take its room (ADR 0060): the slide's `fit`, else the deck's, else 'fill'. */
export const fitOf = (deck, slide) => slide.fit ?? deck.fit ?? 'fill';
const slideShape = (figure) => object({
    layout: { ...oneOf('cover'), description: '"cover": a cover (title slide): the event, title, lead (as the subtitle), date and presenter, large and centred. A cover needs a title and has no figure, columns, columnScale, fit or callouts. Leave it out for an ordinary slide.' },
    title: text('The slide heading, drawn large at the top (on a cover: the title, large and centred).', 120),
    lead: text('One or two sentences under the heading: what the slide says (on a cover: the subtitle).', 300),
    event: text('Cover only: the event or series, such as 「第2回 AI開発の進め方 勉強会」, above the title.', 80),
    date: text('Cover only: the date, drawn as written (any form, such as 「2026年11月27日」 or "2026-11-27").', 60),
    presenter: text('Cover only: who presents, drawn as written (an affiliation or several names in this one text).', 120),
    figure,
    columns: { ...list(object({
            caption: text('A small bold heading over the column, one line.', 60),
            figure: { ...figure, description: 'The column\'s figure (a JSON spec). Write either figure or text.' },
            text: text('Short text for the column: lines separated by "\\n"; a line starting with ・ or "- " is a bullet. Write either figure or text.', 600),
            width: { oneOf: [count('The column\'s share of the row (1 to 3).', 3), { type: 'string', const: 'auto' }], description: 'The column\'s share of the row: 1 to 3, or "auto" (the default): when every column is auto, the shares are chosen to leave the least empty room on the slide with every text at 9pt or more (fit "width": equal shares).' },
        }, [], 'One column: a figure or short text.'), MAX_COLUMNS, MIN_COLUMNS), description: 'Two or three columns side by side, in place of the figure. Not on a cover.' },
    columnScale: { ...oneOf('each', 'same'), description: '"each" (default): each column\'s figure as large as it fits; "same": every figure at one scale (to compare a before and an after). Not on a cover.' },
    fit: { ...oneOf('fill', 'width'), description: 'How the figures take the room the slide leaves: "fill" (default) lays each out at the width that draws it largest (up to 1.5 times), so little room is left empty; "width" keeps each at its own width (or its column\'s) and scales it up to 1.25 times. Not on a cover.' },
    callouts: { ...list(object({
            label: text('Plain words before the emphasised text, such as 「足す一文：」.', 60),
            text: text('The emphasised text, drawn bold in a tinted box near the bottom of the slide.', 300),
        }, ['text']), MAX_CALLOUTS), description: 'Up to three emphasised lines near the bottom of the slide. Not on a cover.' },
    source: text('Where the facts come from, drawn small at the bottom.', 300),
    notes: text('Speaker notes. Lines are separated by "\\n".', 5000),
}, [], 'One 16:9 slide. Every field is optional, but a slide needs a title, a figure or columns. figure and columns do not go together. With "layout": "cover" it is a cover: title (required), lead, event, date, presenter, source and notes only.');
const { canvas: _canvas, ...FIGURE_FIELDS } = specSchema.properties ?? {}; // a deck slide sizes its figure itself (validateDeck refuses a canvas)
const FIGURE = { ...specSchema, properties: FIGURE_FIELDS, description: 'The figure: the same JSON spec as a single diagram. It is laid out at its own size and then scaled to the room the slide leaves. Not on a cover.' };
/** The deck's JSON Schema, figures included (each is a full spec). */
export const deckSchema = object({
    title: text('The file\'s title (the presentation\'s properties).', 200),
    fit: { ...oneOf('fill', 'width'), description: 'How the figures take the room the slide leaves: "fill" (default) lays each out at the width that draws it largest (up to 1.5 times), so little room is left empty; "width" keeps each at its own width (or its column\'s) and scales it up to 1.25 times.' },
    slides: list(slideShape(FIGURE), MAX_SLIDES, 1),
}, ['slides'], 'A PowerPoint deck of 16:9 slides. A cover is a slide with "layout": "cover".');
// the same shape with the figure left to validateSpec, so that a figure's mistakes come back once, with the part rules too
const SHAPE = object({ title: deckSchema.properties?.['title'], fit: deckSchema.properties?.['fit'], slides: list(slideShape({ description: 'figure' }), MAX_SLIDES, 1) }, ['slides']);
// notes is the one field with line breaks (and tabs, for indented points): the schema's check forbids control characters, so it is checked with them taken out
const NOTES_BREAKS = /\r\n|\r|\n/g;
/** Where a figure's issue is in the deck: `slides[i].figure` and then the spec's own path ('' is the whole figure). */
export const figurePath = (i, path) => `slides[${i}].figure${path ? `.${path}` : ''}`;
/** Where a column figure's issue is: `slides[i].columns[j].figure` and then the spec's own path. */
export const columnFigurePath = (i, j, path) => `slides[${i}].columns[${j}].figure${path ? `.${path}` : ''}`;
/** Every problem with `input`, each with its place; empty when it can be drawn. At most MAX_ISSUES (the last says how many more). */
export function validateDeck(input) {
    const flat = withoutBreaks(input);
    const issues = validateAgainst(SHAPE, flat);
    const slides = flat?.['slides'];
    if (Array.isArray(slides))
        slides.forEach((s, i) => {
            if (typeof s !== 'object' || s === null)
                return;
            const slide = s;
            if (slide['layout'] === 'cover') {
                // a cover (ADR 0066 D2): its title is required, and what it does not draw is a mistake where it is written
                if (slide['title'] === undefined)
                    issues.push({ path: `slides[${i}].title`, message: 'a cover needs a title' });
                for (const k of NOT_ON_COVER)
                    if (slide[k] !== undefined)
                        issues.push({ path: `slides[${i}].${k}`, message: notOnCover(k) });
                return;
            }
            if (slide['layout'] === undefined)
                for (const k of COVER_ONLY)
                    if (slide[k] !== undefined)
                        issues.push({ path: `slides[${i}].${k}`, message: 'is drawn only on a cover: add "layout": "cover" to the slide, or take it out' });
            if (slide['title'] === undefined && slide['figure'] === undefined && slide['columns'] === undefined)
                issues.push({ path: `slides[${i}]`, message: 'needs a title, a figure or columns' });
            if (slide['figure'] !== undefined && slide['columns'] !== undefined)
                issues.push({ path: `slides[${i}]`, message: 'has both figure and columns: write one of them (put the figure in a column)' });
            if (slide['figure'] !== undefined)
                checkFigure(slide['figure'], path => figurePath(i, path), issues);
            const columns = slide['columns'];
            if (Array.isArray(columns))
                columns.forEach((c, j) => {
                    if (typeof c !== 'object' || c === null)
                        return;
                    const col = c, has = (k) => col[k] !== undefined;
                    if (has('figure') === has('text'))
                        issues.push({ path: `slides[${i}].columns[${j}]`, message: has('figure') ? 'has both figure and text: write one of them' : 'needs a figure or text' });
                    if (has('figure'))
                        checkFigure(col['figure'], path => columnFigurePath(i, j, path), issues);
                });
        });
    return capped(issues);
}
/**
 * A slide's or a column's figure, its issues placed by `at`. A deck slide sizes its figure to the room it leaves (a column's figure to its
 * column, ADR 0059); a canvas is a whole slide of its own, so the two cannot both decide. Said once, not with the canvas's own mistakes,
 * and the rest of the figure is checked without it, so a bad canvas does not hide its other mistakes.
 */
function checkFigure(figure, at, issues) {
    const canvas = typeof figure === 'object' && figure !== null && !Array.isArray(figure) && Object.hasOwn(figure, 'canvas');
    if (canvas)
        issues.push({ path: at('canvas'), message: 'is for a figure drawn alone: a deck slide sizes its figure to the room left on the slide (leave canvas out)' });
    const { canvas: _refused, ...rest } = canvas ? figure : {};
    for (const f of validateSpec(canvas ? rest : figure))
        issues.push({ path: at(f.path), message: f.message });
}
/** The input with the line breaks of every slide's notes and column texts replaced by spaces (only for checking). */
function withoutBreaks(input) {
    const slides = input?.['slides'];
    if (!Array.isArray(slides))
        return input;
    const flat = (v) => typeof v === 'string' ? v.replace(NOTES_BREAKS, ' ').replace(/\t/g, ' ') : v;
    return { ...input, slides: slides.map((s) => {
            if (typeof s !== 'object' || s === null)
                return s;
            const slide = s, out = { ...slide };
            if (typeof slide['notes'] === 'string')
                out['notes'] = flat(slide['notes']);
            if (Array.isArray(slide['columns']))
                out['columns'] = slide['columns'].map((c) => typeof c === 'object' && c !== null && typeof c['text'] === 'string' ? { ...c, text: flat(c['text']) } : c);
            return out;
        }) };
}
/**
 * The spec a column's figure is laid out from (ADR 0059): one that gives no `width` of its own is laid out at the column's width (so its
 * boxes and tables wrap their text instead of the whole figure being shrunk); `auto` is that width, or null when the spec keeps its own.
 */
export function columnSpec(spec, columnPx) {
    if (typeof spec !== 'object' || spec === null || Array.isArray(spec) || spec['width'] !== undefined)
        return { spec, auto: null };
    const auto = columnLayoutWidth(columnPx, SPEC_WIDTH);
    return auto >= SPEC_WIDTH.max ? { spec, auto: null } : { spec: { ...spec, width: auto }, auto };
}
/** The warning when a column's figure did not fit its column's width and was drawn at the document's width and shrunk instead (ADR 0059). */
export const columnFallbackWarning = (auto, why) => `does not fit the column's ${auto}px (${why.split('\n')[0]?.slice(0, 160)}); drawn at ${SPEC_WIDTH.max}px and shrunk instead: give the column a larger width, fewer words, or a layout that fits, or write the figure's own width`;
/** The columns' shares as written: a number where one is given, null where it is left to choice ('auto' or left out). */
export const writtenShares = (columns) => columns.map(c => typeof c.width === 'number' ? c.width : null);
/** Whether slide's columns are chosen (ADR 0061): every column 'auto' and the slide fills. Otherwise an 'auto' column takes 1. */
export const autoColumns = (deck, slide) => !!slide.columns?.length && fitOf(deck, slide) === 'fill' && writtenShares(slide.columns).every(w => w === null);
/** The columns with the shares to lay them out by: chosen ones where given, else the written ones ('auto' as 1). */
export const sharedColumns = (columns, chosen) => columns.map((c, j) => ({ ...c, width: chosen?.[j] ?? (typeof c.width === 'number' ? c.width : 1) }));
