// Compile-time checks for the DSL. TYPES ONLY: nothing in this file exists at runtime, and every check
// here has a runtime twin (a `throw` in dsl.ts / layout.ts, or a rule of `svg-diagram check`) that still
// fires for JS callers and `.mjs` diagram sources.
//
// Option bags that have mutually dependent fields (box step/title, connect route/bend/dip/label, ...)
// are discriminated unions, so the wrong combination is an ordinary "not assignable" error.

import type {MIN_FONT_SIZE} from './tokens.ts';
import type {Arrow, Bend, BoxOpts, CurvePoint, DiagramOpts, LineStyle, SlideRef, StateMatrixCell, TextTone, Theme} from './types.ts';

// ============================================================================================
// Option bags as discriminated unions
// ============================================================================================

type IntsBelow<N extends number, Acc extends number[] = []> = Acc['length'] extends N ? Acc[number] : IntsBelow<N, [...Acc, Acc['length']]>;
/** Allowed `size:` px values: every integer from MIN_FONT_SIZE (14) up to 72. Sub-14px text is a type error. */
export type FontSize = Exclude<IntsBelow<73>, IntsBelow<typeof MIN_FONT_SIZE>>;

/** diagram({theme}) or diagram({day}); at least one is required. */
type ThemeRule = {theme: Theme; day?: 1 | 2} | {day: 1 | 2; theme?: Theme};
/** fill: true needs `slide` (the slot to fill). */
type FillRule = {fill?: false; slide?: SlideRef} | {fill: true; slide: SlideRef};
export type DiagramInput = DiagramOpts & ThemeRule & FillRule;

/** box({step}) needs a title (the badge aligns to the title's first line). */
type StepRule = {step?: undefined} | {step: number | string; title: string};
/** box() options: BoxOpts + the step rule, with the id type captured as `Id`. */
export type BoxInput<Id extends string = string> = Omit<BoxOpts, 'size'> & {id?: Id; size?: FontSize} & StepRule;

/** loop-under takes `dip`, elbow takes `bend` / `bendOffset`; neither is meaningful for another route. */
type Straight = {route?: 'straight'; dip?: never; bend?: never; bendOffset?: never};
type Elbow = {route: 'elbow'; bend?: Bend; bendOffset?: number; dip?: never};
type LoopUnder = {route: 'loop-under'; dip?: number; bend?: never; bendOffset?: never};
/** chip / labelAt only make sense with a label. */
type LabelRule = {label?: undefined; chip?: never; labelAt?: never} | {label: string; chip?: boolean; labelAt?: number};
interface ConnectLook {arrow?: Arrow; line?: LineStyle; tone?: TextTone; /** legacy */ marker?: boolean; /** legacy */ dashed?: boolean}
/** connect() options. */
export type ConnectInput = ConnectLook & (Straight | Elbow | LoopUnder) & LabelRule;
/** branch() options / targets: the route defaults to 'elbow', so `bend` needs no `route`. */
export type BranchInput = ConnectLook & (Omit<Elbow, 'route'> & {route?: 'elbow'} | {route: 'straight'; dip?: never; bend?: never; bendOffset?: never} | LoopUnder) & LabelRule;

/** pyramid(): at least two layers, bottom to top. */
export type PyramidLayers = [string | {text: string}, string | {text: string}, ...(string | {text: string})[]];
/** curve(): at least two points. */
export type CurvePoints = [CurvePoint, CurvePoint, ...CurvePoint[]];

// ============================================================================================
// stateMatrix()
// ============================================================================================

type FixedTuple<T, N extends number, Acc extends T[] = []> = Acc['length'] extends N ? Acc : FixedTuple<T, N, [...Acc, T]>;
/**
 * One row of a state matrix: EXACTLY one cell per column. An explicit `undefined` is the deliberate "TODO"
 * marker (rule wf-states-todo); a cell left out (too few) or surplus (too many, rule wf-states-ragged) is
 * a type error. Non-literal columns (`string[]`) accept any length.
 */
export type StateRowIn<Cols extends readonly string[]> = {
  label: string;
  note?: string;
  cells: number extends Cols['length'] ? StateMatrixCell[] : FixedTuple<StateMatrixCell, Cols['length']>;
};
