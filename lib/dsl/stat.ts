import {richField} from '../rich.ts';
import type {TextTone} from '../types/core.ts';
import type {BoxBand, RichText, StatConfidence, StatOpts} from '../types/text-bands.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {revealOf, withHandle} from './shared.ts';

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
