import type {ConnectBand, ConnectOpts} from '../types/containers.ts';
import type {ConnectInput, Ok, Refers} from '../strict.ts';
import {connectBand} from './defaults.ts';

// Draws an arrow/line between two named anchors — any box()/row()-child/
// grid()-child that was given an `id`. Refs are "id" (center) or
// "id:side" (side is left/right/top/bottom/center).
// route: 'straight' (default) | 'elbow' (orthogonal; `bend` 0..1, or 'start' / 'end' (the middle leg hugs the source / the target), or 'auto' (the first of end, start, 0.5, 0.25, 0.75 that crosses no other box) places the
// middle leg, default 0.5 — leave a box's bottom/top for a vertical-first
// fork, left/right for a horizontal-first one; leave a vertical gap between
// the tiers for the middle leg and its label) | 'loop-under' (down, across, up — for a
// cycle's return arrow, e.g. connect('step4:bottom', 'step1:bottom',
// {route: 'loop-under', dip: 32})) | 'loop-side' (out past the shared left / right / top side, along it, and back: a return up a
// column, e.g. connect('s7:left', 's1:left', {route: 'loop-side'}); `dip` is how far out, default 32).
// Consumes no vertical space — resolved after the whole stack is laid out,
// so `from`/`to` may reference boxes declared earlier OR later in the stack.
//
// Types: `from` / `to` must be well-formed ('id', 'id:side', 'id:side@t'; side = left|right|top|bottom|center; t = 0..1)
// and add() checks the id exists in the diagram. `dip` only with route 'loop-under' / 'loop-side'; `bend` / `bendOffset` only with
// route 'elbow'; `chip` / `labelAt` only with a `label`.
export function connect<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: ConnectInput): ConnectBand & Refers<F | T>;
export function connect(from: string, to: string, opts: ConnectOpts = {}): ConnectBand {
  return connectBand(from, to, opts);
}

export {bracket, type BracketOpts} from './bracket.ts';
export {callout, type CalloutOpts} from './callout.ts';
export {branch} from './branch.ts';
