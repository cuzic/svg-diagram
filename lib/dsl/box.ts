import {resolveIcon} from '../icon-registry.ts';
import {assertSolidText, richBoxFields} from '../rich.ts';
import type {BoxInput, Declares, HandleOf} from '../strict.ts';
import type {BoxBand, BoxOpts} from '../types/text-bands.ts';
import {ALIGNS, assertFontSize, assertOneOf, EMPHASIS_TONES, TEXT_TONES, withHandle} from './shared.ts';

// `step`: a number/string drawn as a solid numbered badge over the title's
// own baseline (requires `title` — the badge has nothing to align to
// without it).
//
// Types: `step` requires `title`; `size` is one of FontSize (an integer >= 14); unknown keys are rejected; the
// literal `id` is remembered so connect() refs to it can be checked by add().
// Every key box() takes. `satisfies` makes tsc fail when BoxOpts gains or loses a key without this list following.
const BOX_KEYS = {
  id: 1, tone: 1, dashed: 1, align: 1, tag: 1, tagTone: 1, tagAt: 1, stamp: 1, padX: 1, padY: 1, flex: 1, width: 1, col: 1, span: 1, reveal: 1, until: 1,
  titleTone: 1, titleMono: 1, bodyTone: 1, bodyMono: 1, noteTone: 1, step: 1, stepWord: 1, icon: 1, iconTone: 1, iconAt: 1, iconSize: 1, frame: 1, size: 1,
  title: 1, body: 1, lines: 1, note: 1,
} as const satisfies Record<keyof BoxOpts | 'id', 1>;
export function box<const Id extends string = never>(opts: BoxInput<Id>): BoxBand & Declares<Id> & HandleOf<Id>;
export function box(opts: BoxOpts): BoxBand {
  assertOneOf(opts.tone, EMPHASIS_TONES, 'box() tone');
  assertOneOf(opts.align, ALIGNS, 'box() align');
  assertOneOf(opts.tagTone, ['accent', 'muted', 'danger'], 'box() tagTone');
  for (const k of ['titleTone', 'bodyTone', 'noteTone', 'iconTone'] as const) assertOneOf(opts[k], TEXT_TONES, `box() ${k}`);
  const unknown = Object.keys(opts).filter(k => !(k in BOX_KEYS));
  if (unknown.length) throw new Error(`box(): unknown option ${unknown.map(k => `'${k}'`).join(', ')} — the text goes in title / body / lines / note (all options: ${Object.keys(BOX_KEYS).join(', ')})`);
  if (opts.size !== undefined) {
    assertFontSize(opts.size); // the px check stays; lint says the value has no effect (rule box-size-ignored)
  }
  // the plain text (and spans) of every rich field go over the copied options: a band never holds an array
  const band = {type: 'box', ...opts, ...richBoxFields(opts)} as BoxBand;
  assertSolidText(band, 'box()');
  if (band.step != null && !band.title) throw new Error('box({step}) needs a title — the badge aligns to the title\'s first line');
  // the glyph is resolved here (the shell) and carried on the band, so emit stays free of I/O
  if (band.icon !== undefined) band.iconGlyph = resolveIcon(band.icon, 'box({icon})');
  if ((band.iconAt !== undefined || band.iconSize !== undefined) && band.icon === undefined) throw new Error('box({iconAt, iconSize}) needs an icon');
  if (band.iconAt !== undefined && band.iconAt !== 'left' && band.iconAt !== 'top') throw new Error(`box({iconAt}) is 'left' or 'top' (got ${JSON.stringify(band.iconAt)})`);
  return withHandle(band, opts.id);
}
