import type {BranchTarget, ConnectBand, ConnectOpts} from '../types/containers.ts';
import type {TextTone} from '../types/core.ts';
import type {BranchInput, ConnectInput, Ok, Refers} from '../strict.ts';
import type {RevealOpts} from '../types/core.ts';
import {connectBand} from './defaults.ts';

// Draws an arrow/line between two named anchors — any box()/row()-child/
// grid()-child that was given an `id`. Refs are "id" (center) or
// "id:side" (side is left/right/top/bottom/center).
// route: 'straight' (default) | 'elbow' (orthogonal; `bend` 0..1, or 'start' / 'end' (the middle leg hugs the source / the target), or 'auto' (the first of end, start, 0.5, 0.25, 0.75 that crosses no other box) places the
// middle leg, default 0.5 — leave a box's bottom/top for a vertical-first
// fork, left/right for a horizontal-first one; leave a vertical gap between
// the tiers for the middle leg and its label) | 'loop-under' (down, across, up — for a
// cycle's return arrow, e.g. connect('step4:bottom', 'step1:bottom',
// {route: 'loop-under', dip: 32})).
// Consumes no vertical space — resolved after the whole stack is laid out,
// so `from`/`to` may reference boxes declared earlier OR later in the stack.
//
// Types: `from` / `to` must be well-formed ('id', 'id:side', 'id:side@t'; side = left|right|top|bottom|center; t = 0..1)
// and add() checks the id exists in the diagram. `dip` only with route 'loop-under'; `bend` / `bendOffset` only with
// route 'elbow'; `chip` / `labelAt` only with a `label`.
export function connect<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: ConnectInput): ConnectBand & Refers<F | T>;
export function connect(from: string, to: string, opts: ConnectOpts = {}): ConnectBand {
  return connectBand(from, to, opts);
}
export interface BracketOpts extends RevealOpts {
  label?: string;
  /** Which side of the span the bracket sits on (default 'below'). */
  side?: 'below' | 'above';
  tone?: TextTone;
}
/**
 * A bracket under (or over) a span of boxes: `bracket(a.left, b.right, {label: 'この区間だけが対象'})`. It runs from the x of the first ref
 * to the x of the second, just outside the lower (or upper) edge of the two boxes; the label sits outside the bracket.
 */
export function bracket<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: BracketOpts): ConnectBand & Refers<F | T>;
export function bracket(from: string, to: string, opts: BracketOpts = {}): ConnectBand {
  const side = opts.side ?? 'below';
  if (side !== 'below' && side !== 'above') throw new Error(`bracket(): side must be 'below' or 'above' (got ${JSON.stringify(side)})`);
  if (opts.label !== undefined && (typeof opts.label !== 'string' || !opts.label.trim())) throw new Error('bracket(): label must not be empty (leave it out for none)');
  return {...connectBand(from, to, {arrow: 'none', tone: opts.tone, label: opts.label, reveal: opts.reveal, until: opts.until}, false), annot: {kind: 'bracket', side}};
}
export interface CalloutOpts extends RevealOpts {
  /** The text of the bubble (one line). */
  text: string;
  /** Which side of the target the bubble is on (default 'above'). */
  side?: 'above' | 'below' | 'left' | 'right';
  tone?: TextTone;
}
/** A bubble with a leader line pointing at a box: `callout('slow', {text: '344ms かかる', side: 'below'})`. Put the target's id or 'id:side'. */
export function callout<const T extends string>(target: Ok<T>, opts: CalloutOpts): ConnectBand & Refers<T>;
export function callout(target: string, opts: CalloutOpts): ConnectBand {
  const side = opts?.side ?? 'above';
  if (!['above', 'below', 'left', 'right'].includes(side)) throw new Error(`callout(): side must be above | below | left | right (got ${JSON.stringify(side)})`);
  if (typeof opts?.text !== 'string' || !opts.text.trim()) throw new Error('callout(): text is required');
  return {...connectBand(target, target, {arrow: 'end', tone: opts.tone, label: opts.text, chip: true, reveal: opts.reveal, until: opts.until}, false), annot: {kind: 'callout', side}};
}
// One box fanning out to several targets (a decision). `targets`:
// [{to, label?, tone?, dashed?}]; opts as connect() (route defaults to
// 'elbow'). Returns an array — d.add() flattens it.
export function branch<const F extends string, const To extends string>(from: Ok<F>, targets: (BranchInput & {to: Ok<To>})[], opts?: BranchInput): (ConnectBand & Refers<F | To>)[];
export function branch(from: string, targets: BranchTarget[], opts: ConnectOpts = {}): ConnectBand[] {
  return targets.map(t => connectBand(from, t.to, {route: 'elbow', ...opts, ...t}));
}
