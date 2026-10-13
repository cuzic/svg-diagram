import type {ScreensBand, ScreensItem, ScreensOpts, WfRoot, WireframeBand, WireframeOpts} from '../types.ts';
import type {AnchorsOf, Declares, HandleOf, ScreensItemInput} from '../strict.ts';
import {assertNoReveal, withAnchors, withHandle} from './shared.ts';
import {NUMBERING, autoNumber} from './wireframe-numbering.ts';

// Low-fidelity UI wireframe of ONE screen, with an optional column of numbered notes.
//   root: a wf.* node or an array of them (laid out top to bottom). See wireframe.ts for the parts.
//   opts: {id, title, tag ('新規' | '改修' | text), h (screen height, default 440; 'fit' = as tall as the content),
//          frame ('screen' (default, heavy) | 'light' | 'none' — use 'light'/'none' for a single component),
//          notes: [string | {title?, text, n?}]  — numbered 1.. to match `n:` on nodes,
//          noteW, skeleton (text becomes grey bars), marks: {new, changed} legend labels,
//          overlays: [wf.dialog(...), wf.toast(...)]  — drawn over the screen (a dialog dims it)}
// id makes the screen frame a connect() anchor.
export function wireframe<const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {id?: Id}): WireframeBand & Declares<Id> & HandleOf<Id>;
export function wireframe(root: WfRoot, opts: WireframeOpts = {}): WireframeBand {
  assertNoReveal(opts, 'wireframe()');
  const numbering = autoNumber(root, opts.overlays);
  return Object.defineProperty(withHandle({type: 'wireframe', root, ...opts}, opts.id), NUMBERING, {value: numbering});
}
// Several screens as thumbnails in a grid — a screen-transition diagram. Join them with connect().
//   items: [{id, title, tag?, root, h?, skeleton?, at?: [row, col]}]   opts: {cols (3), gap (64), rowGap (56), h (320), skeleton}
//   at places an item explicitly; col may be fractional (0.5 = half a column in) to centre a parent over its children.
// Types: item ids are exposed to add() as connect() anchors; `at` is a [row, col] tuple.
export function screens<const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts): ScreensBand & Declares<Id> & AnchorsOf<Id>;
export function screens(items: ScreensItem[], opts: ScreensOpts = {}): ScreensBand {
  assertNoReveal(opts, 'screens()');
  return withAnchors({type: 'screens', items, ...opts}, items.map(i => i.id));
}
