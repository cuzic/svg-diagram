// Rich text: words in a box that are bold or in a tone. The DSL functions (box / banner / caption / group / stat / swimlane)
// are the one place a RichText is read: richOf() flattens it to the plain text plus the spans, and a band only ever holds those
// (lib/layout.ts reads `spans`, everything else keeps reading the plain `title` / `body` / ...). A string is always exactly its
// own characters: nothing in it is parsed, so '**API**', '{frame: false}' and 'lib/**/*.ts' mean what they say.
//
//   box({body: ['許可は ', em.danger(em.b('ユーザー')), ' が決める']})
import {isSolidTone, textKeyOf} from './tokens.ts';
import type {TextTone} from './types/core.ts';
import type {BoxBand, BoxLine, BoxOpts, RichSpans, RichText, Span, Styled} from './types/text-bands.ts';

/** The brand of a Styled part. */
export const RICH = Symbol('svg-diagram.rich');

const isStyled = (x: unknown): x is Styled => typeof x === 'object' && x !== null && (x as {[RICH]?: unknown})[RICH] === true;

function styled(fn: string, of: string | Styled, style: {bold?: true; tone?: TextTone}): Styled {
  if (typeof of !== 'string' && !isStyled(of)) throw new Error(`em.${fn}() takes a string or another em.* part (got ${Array.isArray(of) ? 'an array: write em.b(\'a\'), em.b(\'b\') as separate items' : typeof of})`);
  return {[RICH]: true, of, ...style};
}

/** The parts of rich text: em.b('bold'), em.danger('red'), em.danger(em.b('both')). Pass them in an array next to plain strings. */
export const em = {
  /** Bold. */
  b: (of: string | Styled): Styled => styled('b', of, {bold: true}),
  accent: (of: string | Styled): Styled => styled('accent', of, {tone: 'accent'}),
  danger: (of: string | Styled): Styled => styled('danger', of, {tone: 'danger'}),
  muted: (of: string | Styled): Styled => styled('muted', of, {tone: 'muted'}),
  /** The normal text colour, inside a run that is in another tone. */
  text: (of: string | Styled): Styled => styled('text', of, {tone: 'text'}),
};

/** What the field being flattened is: where it is (for messages), whether its run is bold, and its tone. */
export interface RichContext {field: string; bold: boolean; tone?: TextTone}

/**
 * Flattens rich text into its plain text and spans. The spans are the pieces in order (neighbours of one style are merged), so
 * they concatenate to `text`; text with no bold / tone part has `spans: undefined`.
 * Throws for a part that would not show: em.b() in a bold run, a tone equal to the run's, a tone inside another tone.
 */
export function richOf(input: RichText, ctx: RichContext): {text: string; spans?: Span[]} {
  if (typeof input === 'string') return {text: input};
  if (!Array.isArray(input)) throw new Error(`${ctx.field}: rich text is a string or an array of strings and em.* parts${isStyled(input) ? ' (wrap a single em.* part in an array)' : ''}`);
  const out: Span[] = [];
  const push = (text: string, bold: boolean, tone: TextTone | undefined): void => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && !!last.bold === bold && last.tone === tone) last.text += text;
    else out.push({text, ...(bold ? {bold: true} : {}), ...(tone ? {tone} : {})});
  };
  const walk = (part: unknown, bold: boolean, tone: TextTone | undefined): void => {
    if (typeof part === 'string') return push(part, bold, tone);
    if (!isStyled(part)) throw new Error(`${ctx.field}: an item of rich text must be a string or an em.* part (got ${Array.isArray(part) ? 'an array' : typeof part})`);
    if (part.bold && ctx.bold) throw new Error(`${ctx.field}: em.b() has no effect here, the text is already bold — put the words to stress in a body / note / line that is not bold`);
    if (part.tone) {
      if (tone) throw new Error(`${ctx.field}: em.${part.tone}() inside em.${tone}() — a part has one colour (em.b() may be combined with a colour)`);
      if (textKeyOf(part.tone) === textKeyOf(ctx.tone)) throw new Error(`${ctx.field}: em.${part.tone}() is the colour this text already has, so it would show nothing`);
    }
    walk(part.of, bold || !!part.bold, part.tone ?? tone);
  };
  for (const part of input) walk(part, false, undefined);
  const text = out.map(sp => sp.text).join('');
  return {text, spans: out.some(sp => sp.bold || sp.tone) ? out : undefined};
}

/**
 * A solid / solid-danger box draws every run in white, so a colour of its own (a *Tone field, a line's tone, an em.* colour)
 * would be the fill's own colour or a dark one on it. em.b() is fine. `what` names the caller for the message.
 */
export function assertSolidText(band: {tone?: string; titleTone?: string; bodyTone?: string; noteTone?: string; iconTone?: string; headlineTone?: string; subTone?: string; lines?: readonly unknown[]; spans?: RichSpans}, what: string): void {
  if (!isSolidTone(band.tone)) return;
  const bad = (field: string, tone: string): never => { throw new Error(`${what}: tone '${band.tone}' draws white text, so ${field} '${tone}' would not show — leave the colour out (em.b() is fine)`); };
  for (const k of ['titleTone', 'bodyTone', 'noteTone', 'iconTone', 'headlineTone', 'subTone'] as const) if (band[k]) bad(k, band[k]);
  for (const [i, l] of (band.lines ?? []).entries()) {
    const line = l as {tone?: string; spans?: readonly Span[]};
    if (typeof l === 'string') continue;
    if (line.tone) bad(`lines[${i}].tone`, line.tone);
    for (const sp of line.spans ?? []) if (sp.tone) bad(`em.${sp.tone}() in lines[${i}]`, sp.tone);
  }
  for (const [field, spans] of Object.entries(band.spans ?? {}) as [string, readonly Span[] | undefined][]) for (const sp of spans ?? []) if (sp.tone) bad(`em.${sp.tone}() in ${field}`, sp.tone);
}

/** Throws when hand-made spans (add() takes a band as it is) do not concatenate to the text they claim to be the pieces of. */
export function assertSpans(text: string, spans: Span[], what: string): void {
  if (spans.map(sp => sp.text).join('') !== text) throw new Error(`${what}: spans do not add up to the text "${text.slice(0, 30)}" — build rich text with box({body: [...]}) and em.*, not by hand`);
}

interface Field {text: string | undefined; spans?: Span[]}
/** A text field as the band keeps it (banner headline / sub, caption text, group title ...): a string stays as it is; an array becomes its plain text (undefined when empty) and spans. */
export function richField(input: RichText | undefined, ctx: RichContext): Field {
  if (input === undefined || typeof input === 'string') return {text: input};
  const r = richOf(input, ctx);
  return {text: r.text || undefined, spans: r.spans};
}

/**
 * The text fields of a box (box() and a swimlane step) in band form. Only what changed is returned, so a box written with
 * strings only is the same band as before; spread it AFTER the options (`{type: 'box', ...opts, ...richBoxFields(opts)}`) so
 * no array is left in the band.
 */
export function richBoxFields(opts: BoxOpts, what = 'box()'): Partial<Pick<BoxBand, 'title' | 'body' | 'note' | 'lines' | 'spans'>> {
  const out: Partial<Pick<BoxBand, 'title' | 'body' | 'note' | 'lines' | 'spans'>> = {};
  const spans: RichSpans = {};
  const field = (key: 'title' | 'body' | 'note', bold: boolean, tone: TextTone | undefined): void => {
    if (typeof opts[key] === 'string' || opts[key] === undefined) return;
    const f = richField(opts[key], {field: `${what} ${key}`, bold, tone});
    out[key] = f.text;
    if (f.spans) spans[key] = f.spans;
  };
  field('title', true, opts.titleTone);
  field('body', false, opts.bodyTone);
  field('note', false, opts.noteTone ?? (isSolidTone(opts.tone) ? undefined : 'muted'));
  if (opts.lines?.some(l => typeof l !== 'string' && typeof (l as {text?: unknown}).text !== 'string')) {
    out.lines = opts.lines.map((l, i): BoxLine => {
      if (typeof l === 'string') return l;
      if (Array.isArray(l) || isStyled(l)) throw new Error(`${what} lines[${i}]: an em.* part (or an array) is not a line — write {text: [...]} for a line with stressed words, or put the parts in body`);
      if (typeof l.text === 'string') return l as BoxLine;
      if (!Array.isArray(l.text)) throw new Error(`${what} lines[${i}]: text must be a string or an array of strings and em.* parts`);
      const f = richField(l.text, {field: `${what} lines[${i}]`, bold: !!l.bold, tone: l.tone});
      return f.spans ? {...l, text: f.text ?? '', spans: f.spans} : {...l, text: f.text ?? ''};
    });
  }
  if (Object.keys(spans).length) out.spans = spans;
  return out;
}
