import {banner, caption, row, stat} from './dsl.ts';
import type {BannerBand, BannerOpts, BoxBand, CaptionBand, RichText, RowBand, StatOpts} from './types.ts';
import type {Declares, IdsOf} from './strict.ts';

/** The big number of a hero(): stat()'s value and label, and its own options (size defaults to 'display'). */
export interface HeroStat<Id extends string = string> extends Omit<StatOpts, 'id' | 'width' | 'col' | 'span'> {
  value: string | number;
  label: RichText;
  id?: Id;
}

export interface HeroOpts<C extends BoxBand = BoxBand, Id extends string = never> {
  /** The chapter's claim, as a banner above the figure (any banner() option: headline, sub, tone, headlineRole ...). */
  banner?: BannerOpts;
  stat: HeroStat<Id>;
  /** The flow: box()es joined by arrows, left to right (and, with layout 'side', on into the number: the result the flow produces). */
  flow: readonly C[];
  /** 'side': the flow, then the number it leads to, in one row (default for 4 steps or fewer). 'stack': the number above the flow (default for 5 or more). */
  layout?: 'side' | 'stack';
  /** A line under the figure (bold, text colour). */
  caption?: RichText;
  /** A muted line under that: the source, the condition, the caveat. */
  note?: RichText;
}

type HeroBand = BannerBand | RowBand | CaptionBand;

const SIDE_MAX_STEPS = 4;
const SIDE_STAT_FLEX = 1.5; // the number is wider than a step (a step has flex 1)

/**
 * The figure that opens a chapter: a big number (stat), the flow that produces it (boxes joined by arrows), and a caption / note,
 * under an optional banner. Plain bands, no layout rules of its own: banner(), one row({arrows: 'between'}) of the flow's boxes and the
 * stat() (or a row of the stat() above a row of the boxes), caption(), caption().
 *   hero({banner: {headline: '承認待ちが 3 日から 1 日へ'}, stat: {value: '-67%', label: '承認の待ち時間', tone: 'accent'},
 *         flow: [box({title: '申請'}), box({title: '一次承認'}), box({title: '決裁'})], note: '出典: 社内調査 2026'})
 */
export function hero<C extends BoxBand, const Id extends string = never>(opts: HeroOpts<C, Id>): (HeroBand & Declares<IdsOf<C> | Id>)[];
export function hero(opts: HeroOpts<BoxBand, string>): HeroBand[] {
  if (!opts || typeof opts !== 'object' || !opts.stat || opts.stat.value === undefined || opts.stat.label === undefined) throw new Error('hero(): needs a stat: {value, label}');
  if (!Array.isArray(opts.flow) || opts.flow.length === 0) throw new Error('hero(): needs a flow of at least one box()');
  for (const [i, s] of opts.flow.entries()) if (s?.type !== 'box') throw new Error(`hero(): flow[${i}] is ${s?.type === undefined ? 'not a band' : `a ${s.type}()`}, but a flow takes box() only`);
  const layout = opts.layout ?? (opts.flow.length <= SIDE_MAX_STEPS ? 'side' : 'stack');
  if (layout !== 'side' && layout !== 'stack') throw new Error(`hero(): layout must be 'side' or 'stack' (got ${String(layout)})`);
  const {value, label, ...statOpts} = opts.stat;
  const number = stat(value, label, {...statOpts, size: statOpts.size ?? 'display', flex: statOpts.flex ?? (layout === 'side' ? SIDE_STAT_FLEX : undefined)});
  const out: HeroBand[] = [];
  if (opts.banner) out.push(banner(opts.banner));
  if (layout === 'side') out.push(row([...opts.flow, number], {arrows: 'between'}));
  else out.push(row([number]), row([...opts.flow], {arrows: 'between'}));
  if (opts.caption !== undefined) out.push(caption(opts.caption, {bold: true, tone: 'text'}));
  if (opts.note !== undefined) out.push(caption(opts.note));
  return out;
}
