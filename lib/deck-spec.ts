// A deck: slides of 16:9, each with a heading, a lead, a figure (a JSON spec, lib/spec.ts), callouts, a source line and speaker notes
// (ADR 0055). The input, its JSON Schema and its checks, with places such as `slides[2].figure.parts[0].nodes[1]`. Like lib/spec.ts, nothing
// here touches the disk or a process.
import {capped, specSchema, validateAgainst, validateSpec} from './spec.ts';
import {list, object, text, type Json, type JsonSchema, type SpecIssue} from './spec-kit.ts';

/** Slides in one deck. */
export const MAX_SLIDES = 30;
export const MAX_CALLOUTS = 3;

export interface DeckCallout {label?: string; text: string}
export interface DeckSlide {title?: string; lead?: string; figure?: unknown; callouts?: DeckCallout[]; source?: string; notes?: string}
export interface DeckSpec {title?: string; slides: DeckSlide[]}

const slideShape = (figure: JsonSchema): JsonSchema => object({
  title: text('The slide heading, drawn large at the top.', 120),
  lead: text('One or two sentences under the heading: what the slide says.', 300),
  figure,
  callouts: list(object({
    label: text('Plain words before the emphasised text, such as 「足す一文：」.', 60),
    text: text('The emphasised text, drawn bold in a tinted box near the bottom of the slide.', 300),
  }, ['text']), MAX_CALLOUTS),
  source: text('Where the facts come from, drawn small at the bottom.', 300),
  notes: text('Speaker notes. Lines are separated by "\\n".', 5000),
}, [], 'One 16:9 slide. Every field is optional, but a slide needs a title or a figure.');

const FIGURE: JsonSchema = {...specSchema, description: 'The figure: the same JSON spec as a single diagram. It is laid out at its own size and then scaled to the room the slide leaves.'};

/** The deck's JSON Schema, figures included (each is a full spec). */
export const deckSchema: JsonSchema = object({
  title: text('The file\'s title (the presentation\'s properties).', 200),
  slides: list(slideShape(FIGURE), MAX_SLIDES, 1),
}, ['slides'], 'A PowerPoint deck of 16:9 slides.');

// the same shape with the figure left to validateSpec, so that a figure's mistakes come back once, with the part rules too
const SHAPE: JsonSchema = object({title: deckSchema.properties?.['title'] as JsonSchema, slides: list(slideShape({description: 'figure'}), MAX_SLIDES, 1)}, ['slides']);
// notes is the one field with line breaks (and tabs, for indented points): the schema's check forbids control characters, so it is checked with them taken out
const NOTES_BREAKS = /\r\n|\r|\n/g;

/** Where a figure's issue is in the deck: `slides[i].figure` and then the spec's own path ('' is the whole figure). */
export const figurePath = (i: number, path: string | null): string => `slides[${i}].figure${path ? `.${path}` : ''}`;

/** Every problem with `input`, each with its place; empty when it can be drawn. At most MAX_ISSUES (the last says how many more). */
export function validateDeck(input: unknown): SpecIssue[] {
  const flat = withoutBreaks(input);
  const issues = validateAgainst(SHAPE, flat);
  const slides = (flat as Json | null)?.['slides'];
  if (Array.isArray(slides)) slides.forEach((s: unknown, i) => {
    if (typeof s !== 'object' || s === null) return;
    const slide = s as Json;
    if (slide['title'] === undefined && slide['figure'] === undefined) issues.push({path: `slides[${i}]`, message: 'needs a title or a figure'});
    if (slide['figure'] !== undefined) for (const f of validateSpec(slide['figure'])) issues.push({path: figurePath(i, f.path), message: f.message});
  });
  return capped(issues);
}

/** The input with the line breaks of every slide's notes replaced by spaces (only for checking). */
function withoutBreaks(input: unknown): unknown {
  const slides = (input as Json | null)?.['slides'];
  if (!Array.isArray(slides)) return input;
  return {...(input as Json), slides: slides.map((s: unknown) => typeof s === 'object' && s !== null && typeof (s as Json)['notes'] === 'string'
    ? {...(s as Json), notes: ((s as Json)['notes'] as string).replace(NOTES_BREAKS, ' ').replace(/\t/g, ' ')} : s)};
}
