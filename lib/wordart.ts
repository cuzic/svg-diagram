// wordart(): decorated headline text — bold, outlined (縁取り), shadowed, glowing, bent, turned ... — set horizontally or vertically
// (縦書き), as one band (docs/adr/0009). The pieces:
//   wordart-types.ts     the options, the resolved look, the placed band
//   wordart-look.ts      presets, the look, legibility, and the layers a wordart is painted in
//   wordart-vertical.ts  vertical text: tokens, kinsoku, columns
//   wordart-layout.ts    what to measure and where everything goes
// this file is the constructor (validation) and the one place the rest is imported from.
import {MIN_FONT_SIZE} from './tokens.ts';
import {PRESETS, WEIGHT_OF, ART_TONES, asList} from './wordart-look.ts';
import type {WordArtBand, WordArtOpts} from './wordart-types.ts';

export * from './wordart-types.ts';
export * from './wordart-look.ts';
export * from './wordart-vertical.ts';
export * from './wordart-layout.ts';

// ---------------------------------------------------------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------------------------------------------------------

/** Throws `wordart(): <what> <must be ...> (got X)` unless `ok`; `undefined` is always fine (the option is not given). */
const check = (what: string, v: unknown, ok: (v: any) => boolean, must: string): void => {
  if (v !== undefined && !ok(v)) throw new Error(`wordart(): ${what} ${must} (got ${typeof v === 'object' ? JSON.stringify(v) : String(v)})`);
};
const oneOf = (...xs: readonly string[]) => (v: unknown): boolean => xs.includes(v as string);
const isTone = (none = false) => (v: unknown): boolean => ART_TONES.has(v as string) || (none && v === 'none');
const positive = (v: unknown): boolean => typeof v === 'number' && v > 0;
const finite = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
const list = (xs: readonly string[]): string => xs.join(' | ');
const TONES = [...ART_TONES];

export function wordartBand(text: string, opts: WordArtOpts = {}): WordArtBand {
  if (typeof text !== 'string' || !text.trim()) throw new Error('wordart(): needs a non-empty text');
  const {id, reveal, until, ...o} = opts;
  check('style', o.style, v => v in PRESETS, `must be one of ${list(Object.keys(PRESETS))}`);
  check('writing', o.writing, oneOf('horizontal', 'vertical'), "must be 'horizontal' or 'vertical'");
  check('weight', o.weight, v => v in WEIGHT_OF, "must be 'normal' or 'bold'");
  check('font', o.font, oneOf('sans', 'mono'), "must be 'sans' or 'mono'");
  check('align', o.align, oneOf('start', 'center', 'end'), "must be 'start' | 'center' | 'end'");
  check('flip', o.flip, oneOf('horizontal', 'vertical', 'both'), "must be 'horizontal' | 'vertical' | 'both'");
  check('size', o.size, v => typeof v !== 'number' || v >= MIN_FONT_SIZE, `must be at least ${MIN_FONT_SIZE}px`);
  check('tone', o.tone, isTone(true), `must be a tone (${list(TONES)} | none)`);
  check('plate', o.plate, isTone(), `must be a tone (${list(TONES)})`);
  check('gradient from', o.gradient?.from, isTone(), `must be a tone (${list(TONES)})`);
  check('gradient to', o.gradient?.to, isTone(), `must be a tone (${list(TONES)})`);
  check('gradient angle', o.gradient?.angle, finite, 'must be a number of degrees');
  for (const x of asList(o.outline) ?? []) { check('outline tone', x.tone, isTone(), `must be a tone (${list(TONES)})`); check('outline width', x.width, positive, 'must be > 0'); }
  for (const [name, spec] of [['shadow', o.shadow], ['glow', o.glow], ['extrude', o.extrude]] as const) check(`${name} tone`, typeof spec === 'object' ? spec.tone : undefined, isTone(), `must be a tone (${list(TONES)})`);
  check('glow radius', typeof o.glow === 'object' ? o.glow.radius : undefined, positive, 'must be > 0');
  check('extrude depth', typeof o.extrude === 'object' ? o.extrude.depth : undefined, positive, 'must be > 0');
  check('reflection opacity', typeof o.reflection === 'object' ? o.reflection.opacity : undefined, v => v > 0 && v <= 1, 'must be in (0, 1]');
  check('spacing', o.spacing, v => v >= 0, 'must be >= 0');
  check('limit', o.limit, positive, 'must be > 0');
  check('rotate', o.rotate, finite, 'must be a number of degrees');
  check('arc', o.arc, v => finite(v) && v !== 0 && Math.abs(v) <= 300, 'must be a number of degrees, not 0, at most 300 either way');
  if (o.arc !== undefined && o.writing === 'vertical') throw new Error('wordart(): arc bends a horizontal line; it cannot be combined with writing: vertical');
  if (o.arc !== undefined && text.includes('\n')) throw new Error('wordart(): arc bends one line; the text has a newline');
  return {type: 'wordart', text, ...(id ? {id} : {}), ...(reveal === undefined ? {} : {reveal}), ...(until === undefined ? {} : {until}), opts: o};
}
