import {walkBands} from '../rules.ts';
import {CAUSE_ROLES} from '../toc.ts';
import {assertSolidText, richField} from '../rich.ts';
import {ROLES, HEADLINE_ROLES, OPT_IN_TEXT_MAX, isSolidTone} from '../tokens.ts';
import type {LegendBand, LegendItem, LegendOpts, RawBand, RawOpts} from '../types/containers.ts';
import type {TextTone} from '../types/core.ts';
import type {Band} from '../types/index.ts';
import type {BannerBand, BannerOpts, BoxBand, RichText, StatConfidence, StatOpts} from '../types/text-bands.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {assertNoReveal, assertOneOf, assertTextRole, EMPHASIS_TONES, revealOf, withHandle} from './shared.ts';

export {caption} from './caption.ts';
export {box} from './box.ts';
/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export function fillScaleLimit(bands: Band[]): number {
  const optIn = walkBands(bands).flatMap(b => b.type === 'banner' && b.headlineRole ? [ROLES[b.headlineRole]] : (b.type === 'bars' || b.type === 'plane') && b.labelRole ? [ROLES[b.labelRole]] : b.type === 'image' ? [b.labelRole, ...(b.marks ?? []).map(m => m.role), ...(b.labels ?? []).map(l => l.role)].flatMap(r => r ? [ROLES[r]] : []) : []);
  return Math.min(1.8, optIn.length ? OPT_IN_TEXT_MAX / Math.max(...optIn) : 1.8);
}
/** The symbol and the word printed for each stat() confidence (ADR 0023 D8): never a colour alone. */
const CONFIDENCE_LABEL: Record<StatConfidence, string> = {primary: '◎ 一次資料', secondary: '○ 報道・二次資料', unverified: '△ 未確認'};
/** The printed text of a confidence: the override if written, else the default with or without its leading symbol. */
function confidenceText(c: StatConfidence, opts: Pick<StatOpts, 'confidenceStyle' | 'confidenceLabels'>): string {
  return opts.confidenceLabels?.[c] ?? (opts.confidenceStyle === 'text' ? CONFIDENCE_LABEL[c].replace(/^\S+\s/, '') : CONFIDENCE_LABEL[c]);
}
/** A large, atomic value and its muted label. The result is an ordinary plain box, so it works in row(). */
export function stat<const Id extends string = never>(value: string | number, label: RichText, opts?: StatOpts & {id?: Id}): BoxBand & Declares<Id> & HandleOf<Id>;
export function stat(value: string | number, label: RichText, opts: StatOpts = {}): BoxBand {
  if (opts.size !== undefined && opts.size !== 'stat' && opts.size !== 'display') throw new Error(`stat(): size must be 'stat' or 'display' (got ${opts.size})`);
  const text = String(value);
  if (opts.confidence !== undefined && !(opts.confidence in CONFIDENCE_LABEL)) throw new Error(`stat(): confidence must be 'primary', 'secondary' or 'unverified' (got ${JSON.stringify(opts.confidence)})`);
  if (opts.confidenceStyle !== undefined && opts.confidenceStyle !== 'symbol' && opts.confidenceStyle !== 'text') throw new Error(`stat(): confidenceStyle must be 'symbol' or 'text' (got ${JSON.stringify(opts.confidenceStyle)})`);
  for (const [k, v] of Object.entries(opts.confidenceLabels ?? {})) if (!(k in CONFIDENCE_LABEL) || typeof v !== 'string' || !v.trim() || /[\r\n]/.test(v)) throw new Error(`stat(): confidenceLabels takes primary / secondary / unverified, each a non-empty one-line text (got ${JSON.stringify({[k]: v})})`);
  if (opts.source === undefined && opts.confidence !== undefined) throw new Error(`stat(${JSON.stringify(text)}): confidence needs a source (where the number comes from; write the source, or drop the number)`);
  if (opts.source !== undefined && (typeof opts.source !== 'string' || !opts.source.trim() || /[\r\n]/.test(opts.source))) throw new Error(`stat(${JSON.stringify(text)}): source must be a non-empty one-line string`);
  // 'solid' / 'solid-danger' fill the box (white text, so no tone of its own on the value or the label); any other tone colours the value
  const solid = opts.tone === 'solid' || opts.tone === 'solid-danger' ? opts.tone : undefined;
  // 'accent' also fills the card with the accent tone's fill (and outline), as a box of that tone does; the value stays accent text, the label is the normal text colour (muted is too faint on the fill)
  const accent = opts.tone === 'accent' ? 'accent' : undefined;
  const rich = richField(label, {field: 'stat() label', bold: false, tone: solid || accent ? undefined : 'muted'});
  return withHandle({
    type: 'box', id: opts.id, ...(solid ? {tone: solid} : accent ? {tone: accent} : {}), flex: opts.flex, width: opts.width, col: opts.col, span: opts.span, ...revealOf(opts),
    align: 'center', lines: [
      {text, role: opts.size ?? 'stat', bold: true, tone: solid ? undefined : opts.tone as TextTone | undefined},
      {text: rich.text ?? '', ...(solid || accent ? {} : {tone: 'muted' as const}), ...(rich.spans ? {spans: rich.spans} : {})},
      ...(opts.source !== undefined ? [{text: `出典: ${opts.source}${opts.confidence ? `  ${confidenceText(opts.confidence, opts)}` : ''}`, role: 'note' as const, ...(solid || accent ? {} : {tone: 'muted' as const})}] : []),
    ], statValue: text, ...(opts.source !== undefined ? {evidence: {source: opts.source, ...(opts.confidence ? {confidence: opts.confidence} : {})}} : {}),
  }, opts.id);
}
export function banner<const Id extends string = never>(opts: BannerOpts & {id?: Id}): BannerBand & Declares<Id> & HandleOf<Id>;
export function banner(opts: BannerOpts): BannerBand {
  if (opts.headline === undefined) throw new Error('banner() needs a headline (the text key is headline, not text / title)');
  assertOneOf(opts.tone, EMPHASIS_TONES, 'banner() tone');
  assertTextRole(opts.headlineRole, HEADLINE_ROLES, 'banner() headlineRole');
  const headline = richField(opts.headline, {field: 'banner() headline', bold: true, tone: opts.headlineTone});
  const sub = richField(opts.sub, {field: 'banner() sub', bold: false, tone: opts.subTone ?? (isSolidTone(opts.tone) ? undefined : 'muted')});
  const text = {...(typeof opts.headline === 'string' ? {} : {headline: headline.text ?? ''}), ...(typeof opts.sub === 'string' || opts.sub === undefined ? {} : {sub: sub.text})};
  const spans = headline.spans || sub.spans ? {spans: {...(headline.spans ? {headline: headline.spans} : {}), ...(sub.spans ? {sub: sub.spans} : {})}} : {};
  const band = {type: 'banner', tone: opts.tone ?? 'accent', ...opts, ...text, ...spans} as BannerBand;
  assertSolidText(band, 'banner()');
  return withHandle(band, opts.id);
}
// A labelled frame around other bands (a network zone, a service boundary, a
// release phase). children: any bands (row, grid, box, nested group...).
// tone: 'muted' (default, grey fill) | 'accent' | 'plain' (white) | 'danger';
// dashed: draw the boundary dashed (default true for 'plain' = a trust/zone line).
// frame: false draws no frame and no title (pad 0): a bare container, e.g. to put a table / plane / banner in a row() without a doubled outline.
// Types: the ids (and connect() refs) of the children are exposed to add().
export {group} from './group.ts';
// Key for line styles / tones used in the diagram. items:
//   {line: 'solid'|'dashed'|'dotted'|'double', arrow?: 'end'|'both'|'none', weight?: 'strong', label}
//   {tone: 'accent'|'muted'|'plain'|'danger'|'new'|'changed'|'removed', label}
export function legend(items: LegendItem[], opts: LegendOpts = {}): LegendBand {
  assertNoReveal(opts, 'legend()');
  for (const it of items) if (it.weight && it.line === 'double') throw new Error(`legend(): weight '${it.weight}' cannot go with line 'double' ("${it.label}")`);
  for (const it of items) {
    if (it.role !== undefined && !(it.role in CAUSE_ROLES)) throw new Error(`legend(): item "${it.label}" has role ${String(it.role)} (use ${Object.keys(CAUSE_ROLES).join(', ')})`);
    if (it.edge !== undefined && !['and', 'back', 'blocks'].includes(it.edge)) throw new Error(`legend(): item "${it.label}" has edge ${String(it.edge)} (use 'and', 'back' or 'blocks')`);
    if (it.mark !== undefined && it.mark !== 'core') throw new Error(`legend(): item "${it.label}" has mark ${String(it.mark)} (use 'core')`);
    if (it.ftaEvent !== undefined && !['basic', 'undeveloped', 'house', 'condition'].includes(it.ftaEvent)) throw new Error(`legend(): item "${it.label}" has ftaEvent ${String(it.ftaEvent)} (use 'basic', 'undeveloped', 'house' or 'condition')`);
    if (it.ftaGate !== undefined && !['and', 'or', 'vote', 'inhibit'].includes(it.ftaGate)) throw new Error(`legend(): item "${it.label}" has ftaGate ${String(it.ftaGate)} (use 'and', 'or', 'vote' or 'inhibit')`);
  }
  // a weight sample is a line sample: the plain line unless `line` says otherwise
  return {type: 'legend', items: items.map(it => it.weight && !it.line ? {...it, line: 'solid'} : it), align: opts.align ?? 'center'};
}
// Escape hatch. `draw(ctx)` must return a raw SVG fragment string; it
// receives its allocated origin/size and a couple of tone-aware helpers, but
// nothing stops it from emitting arbitrary markup — the fragment is passed
// through emit.ts unmodified. build() runs `lint-svg.ts --strict` on the
// finished file regardless, so an off-token color or sub-14px size written
// here still gets caught before the file is trusted — raw() only escapes
// layout, never the constraint system's verification step.
export function raw(opts: RawOpts): RawBand {
  assertNoReveal(opts, 'raw()');
  if (typeof opts.draw !== 'function') throw new Error('raw({draw}) needs a draw(ctx) function');
  return {type: 'raw', h: opts.h ?? 0, draw: opts.draw};
}
