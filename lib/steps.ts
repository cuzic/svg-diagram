import {box} from './dsl/text-bands.ts';
import {row} from './dsl/containers.ts';
import type {BoxBand, BoxTone, RowBand, TagTone} from './types.ts';
import type {IconName} from './icons.ts';
import type {Declares, RowHandleOf} from './strict.ts';

/** One step of steps(): what happened, in a box with an optional icon, body and tag. */
export interface StepItem {
  title: string;
  body?: string;
  icon?: IconName;
  tag?: string;
  tagTone?: TagTone;
  tone?: BoxTone;
}
export interface StepsOpts {
  /** Number the steps 1, 2, 3 ... with a badge on each title (default false). */
  numbered?: boolean;
  /** The 1-based step to emphasise (one only). */
  highlight?: number;
  /** The tone of the highlighted step (default 'danger'). */
  highlightTone?: 'danger' | 'accent';
  /** Arrows between the boxes (default true). */
  arrows?: boolean;
  gap?: number;
  /** Makes the row an anchor (`id#2` is the second step), like row({id}). */
  id?: string;
}

/**
 * Things that happened in order, with no dates: a row of boxes (number badge, icon, title, body, tag) joined by arrows, one of them
 * optionally emphasised. It is an ordinary row(), so connect() / spotlight / reveal-by-child work as for a row.
 *   steps([{title: '再発', body: '1回目'}, {title: '再発'}, {title: '遮断', icon: 'shield'}], {numbered: true, highlight: 3})
 */
export function steps<const Id extends string = never>(items: StepItem[], opts?: StepsOpts & {id?: Id}): RowBand & Declares<Id> & RowHandleOf<Id>;
export function steps(items: StepItem[], opts: StepsOpts = {}): RowBand {
  if (!Array.isArray(items) || items.length < 2) throw new Error('steps(): needs at least 2 items');
  if (opts.highlight !== undefined && (!Number.isInteger(opts.highlight) || opts.highlight < 1 || opts.highlight > items.length)) throw new Error(`steps(): highlight must be a step number 1..${items.length} (got ${String(opts.highlight)})`);
  if (opts.highlightTone !== undefined && opts.highlightTone !== 'danger' && opts.highlightTone !== 'accent') throw new Error(`steps(): highlightTone must be 'danger' or 'accent' (got ${String(opts.highlightTone)})`);
  const boxes: BoxBand[] = items.map((it, i) => {
    if (typeof it?.title !== 'string' || !it.title.trim()) throw new Error(`steps(): item ${i + 1} needs a title`);
    const hot = opts.highlight === i + 1;
    const tone = hot ? opts.highlightTone ?? 'danger' : it.tone;
    return box({title: it.title, ...(it.body === undefined ? {} : {body: it.body}), ...(it.icon === undefined ? {} : {icon: it.icon}), ...(it.tag === undefined ? {} : {tag: it.tag, ...(it.tagTone ? {tagTone: it.tagTone} : {})}), ...(tone ? {tone} : {}), ...(opts.numbered ? {step: i + 1} : {})});
  });
  return row(boxes, {arrows: opts.arrows === false ? 'none' : 'between', ...(opts.gap === undefined ? {} : {gap: opts.gap}), ...(opts.id === undefined ? {} : {id: opts.id})});
}
