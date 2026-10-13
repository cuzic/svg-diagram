// Compile-time checks for the DSL. TYPES ONLY: nothing in this file exists at runtime, and every check
// here has a runtime twin (a `throw` in dsl.ts / layout.ts, or a rule of `svg-diagram check`) that still
// fires for JS callers and `.mjs` diagram sources.
//
// How the pieces fit:
//   * Constructors return their band intersected with a PHANTOM carrier: `Declares<'id'>` (the anchor ids the
//     band introduces) or `Refers<'id:side'>` (the connect() refs it uses). The carriers are optional
//     properties that never exist at runtime.
//   * `diagram().add(...bands)` gathers the ids carried by the diagram so far plus those of THIS call, and
//     rejects a band whose refs name an id that is not among them (ValidateBands).
//   * Option bags that have mutually dependent fields (box step/title, connect route/bend/dip/label, ...)
//     are discriminated unions, so the wrong combination is an ordinary "not assignable" error.
//   * Where a plain "not assignable" message would be cryptic, the offending value is mapped to a string
//     literal type that IS the message (`Ok<T, Problem>`), or to a required property whose NAME is the
//     message (`Err<M>`), which TypeScript prints verbatim.
//
// A non-literal `string` (an id or ref computed at run time) can never be proven wrong, so it is accepted
// everywhere: every check below degrades to "ok" for `string` and for template-literal patterns.

import type {MIN_FONT_SIZE} from './tokens.ts';
import type {
  Arrow, ArrowWeight, Bend, BoxOpts, PartRow, CurvePoint, DiagramOpts, LineStyle, ScreensItem, SeqDivider, SeqNote, SequenceActor, SeqMessage, SeqSelf,
  RichText, SlideRef, StateMatrixCell, SwimlaneFlow, SwimlaneStep, TextTone, Theme,
} from './types.ts';

// ============================================================================================
// Phantom carriers and their readers
// ============================================================================================

/** The anchor ids a band introduces (box id, row/grid child ids, screens item ids, swimlane step ids ...). */
export interface Declares<I extends string> {readonly '~ids'?: I}
/** The connect() refs ('id', 'id:side', 'id:side@t') a band uses. */
export interface Refers<R extends string> {readonly '~refs'?: R}

type Flat<X> = X extends readonly (infer E)[] ? E : X;
/** Ids declared by one band (or a band array). `never` for bands that carry none. */
export type IdsOf<X> = Flat<X> extends infer E ? (E extends {readonly '~ids'?: infer I} ? Extract<I, string> : never) : never;
export type RefsOf<X> = Flat<X> extends infer E ? (E extends {readonly '~refs'?: infer R} ? Extract<R, string> : never) : never;
/** Ids declared by the tuple of bands handed to add(). */
export type DeclaredIds<B extends readonly unknown[]> = IdsOf<B[number]>;

// ============================================================================================
// Refs: 'id' | 'id:side' | 'id:side@t'
// ============================================================================================

/** `{[x: `a${number}`]: 1}`-style indexes make `{}` assignable; a plain literal makes a required key. */
type IsPattern<R extends string> = {} extends {[K in R]: 1} ? true : false;
export type SideName = 'left' | 'right' | 'top' | 'bottom' | 'center';
type OffsetOk = '0' | '1' | `0.${number}` | `.${number}`;
/** The id of a ref; a row column ('row#5:top', 'row#5-6') belongs to its row's id. */
type IdOf<R extends string> = (R extends `${infer Id}:${string}` ? Id : R) extends infer I extends string ? (I extends `${infer Row}#${string}` ? Row : I) : never;

type SideProblem<R extends string, Rest extends string> =
  IsPattern<Rest> extends true ? never
  : Rest extends SideName ? never
  : Rest extends `${infer S}@${infer T}`
    ? (S extends SideName
        ? (T extends OffsetOk ? never : `connect(): bad offset "@${T}" in "${R}" — use a number from 0 to 1, e.g. "box:left@0.25"`)
        : BadSide<R, S>)
    : BadSide<R, Rest>;
type BadSide<R extends string, S extends string> = `connect(): unknown side "${S}" in "${R}" — use left | right | top | bottom | center`;

/** What is wrong with the SHAPE of a ref (side / offset), as a message; `never` when fine. Needs no id list. */
export type ShapeProblem<R extends string> = R extends string
  ? (R extends HandleRef ? never : IsPattern<R> extends true ? never : R extends `${string}:${infer Rest}` ? SideProblem<R, Rest> : never)
  : never;

/** `T` when the ref is well-formed, otherwise the message (as a type no argument can satisfy). */
export type Ok<T extends string> = [ShapeProblem<T>] extends [never] ? T : ShapeProblem<T>;

/** A ref passed to `d.connect()`: well-formed, and (when earlier add() calls were chained) naming a declared id. */
export type RefIn<Ids extends string, R extends string> =
  [Ids] extends [never] ? Ok<R> : [IdProblem<R, Ids>] extends [never] ? Ok<R> : IdProblem<R, Ids>;

type UnknownId<Id extends string, Known extends string> =
  `unknown anchor id "${Id}" — declare it with {id: '${Id}'} (declared ids: ${Join<Known>})`;
/** Refs among R whose id is not in Known (messages); never for non-literal refs. */
type IdProblem<R extends string, Known extends string> = R extends string
  ? (R extends HandleRef ? never : IsPattern<IdOf<R>> extends true ? never : IdOf<R> extends Known ? never : UnknownId<IdOf<R>, Known>)
  : never;

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type LastOf<U> = UnionToIntersection<U extends unknown ? () => U : never> extends () => infer R ? R : never;
type LastStr<U extends string> = Extract<LastOf<U>, string>;
/** 'a' | 'b' | 'c' -> 'a | b | c' (declaration order, for messages only). */
type Join<U extends string, Acc extends string = ''> =
  [U] extends [never] ? Acc : Join<Exclude<U, LastStr<U>>, Acc extends '' ? LastStr<U> : `${LastStr<U>} | ${Acc}`>;

/** A required property whose NAME is the error message. */
export type Err<M extends string> = {readonly [K in M]: never};

/** The anchor ref format: 'id', 'id:side', 'id:side@t'. For documentation and signatures; connect() validates the real literal. */
export type AnchorRef<Id extends string = string> = Id | `${Id}:${SideName}` | `${Id}:${SideName}@${number}`;

// ============================================================================================
// Handles: `const list = box({id: 'list'})` doubles as a typed anchor, `connect(list.right, detail.at('top', 0.25))`
// ============================================================================================

/**
 * A ref string produced by a handle. It is a plain string at run time; the brand means it can only come from a
 * constructor that declared the id, so it needs no id lookup (the handle's own band declares the id).
 */
export type HandleRef = string & {readonly '~anchor': true};
/** Added (as non-enumerable properties) to a band built with a literal `id`. */
export interface Handle {
  readonly id: string;
  readonly left: HandleRef;
  readonly right: HandleRef;
  readonly top: HandleRef;
  readonly bottom: HandleRef;
  readonly center: HandleRef;
  /** `at('bottom', 0.25)` = 'id:bottom@0.25' (t = 0..1 along that side). */
  at(side: SideName, t: number): HandleRef;
}
/**
 * A row({id}) is an anchor itself and also hands out its columns: `r.col(5).top` is the top edge of the 5th column of a
 * `cols` row (of the 5th child on a row without `cols`); `r.col(5, 6)` spans columns 5..6. Row-height, so a connector
 * lands exactly above / below that column whatever the boxes in it are.
 */
export interface RowHandle extends Handle {
  col(n: number, to?: number): Handle;
}
export type RowHandleOf<Id extends string> = [Id] extends [never] ? unknown : RowHandle;
/** `Handle` only when the id is known (a band built without an id has nothing to point at). */
export type HandleOf<Id extends string> = [Id] extends [never] ? unknown : Handle;
/** screens() / swimlane(): one handle per item / step id, under `.anchors`. */
export type AnchorsOf<Id extends string> = {readonly anchors: {readonly [K in Id]: Handle}};

// ============================================================================================
// diagram().add()
// ============================================================================================

type ElementCheck<Known extends string, X> = [IdProblem<RefsOf<X>, Known>] extends [never] ? unknown : Err<IdProblem<RefsOf<X>, Known>>;

/**
 * Per-argument check of add(): each connect ref must name an id declared EARLIER on the diagram (carried by its
 * type when add() calls are chained) or ANYWHERE in this very call (forward refs inside one call are fine).
 * When nothing is declared yet the refs can only point at earlier statements, which the type system cannot
 * see (`d.add(x); d.add(connect(...))` -- add()'s result is not assigned back), so nothing is checked.
 */
export type ValidateBands<Ids extends string, B extends readonly unknown[]> =
  [Ids | DeclaredIds<B>] extends [never] ? unknown
  : {[K in keyof B]: ElementCheck<Ids | DeclaredIds<B>, B[K]>};

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
type StepRule = {step?: undefined} | {step: number | string; title: RichText};
/** box() options: BoxOpts + the step rule, with the id type captured as `Id`. */
export type BoxInput<Id extends string = string> = Omit<BoxOpts, 'size'> & {id?: Id; /** @deprecated Has no effect (see BoxStyleOpts.size): use a role. */ size?: FontSize} & StepRule;

/** loop-under takes `dip`, elbow takes `bend` / `bendOffset`; neither is meaningful for another route. */
type Straight = {route?: 'straight'; dip?: never; bend?: never; bendOffset?: never};
type Elbow = {route: 'elbow'; bend?: Bend; bendOffset?: number; dip?: never};
type LoopUnder = {route: 'loop-under'; dip?: number; bend?: never; bendOffset?: never};
/** chip / labelAt only make sense with a label. */
type LabelRule = {label?: undefined; chip?: never; labelAt?: never} | {label: string; chip?: boolean; labelAt?: number};
interface ConnectLook {arrow?: Arrow; line?: LineStyle; weight?: ArrowWeight; tone?: TextTone; reveal?: number; until?: number; /** legacy */ marker?: boolean; /** legacy */ dashed?: boolean}
/** connect() options. */
export type ConnectInput = ConnectLook & (Straight | Elbow | LoopUnder) & LabelRule;
/** branch() options / targets: the route defaults to 'elbow', so `bend` needs no `route`. */
export type BranchInput = ConnectLook & (Omit<Elbow, 'route'> & {route?: 'elbow'} | {route: 'straight'; dip?: never; bend?: never; bendOffset?: never} | LoopUnder) & LabelRule;

/** pyramid(): at least two layers, bottom to top. */
export type PyramidLayers = [string | {text: string}, string | {text: string}, ...(string | {text: string})[]];
/** curve(): at least two points. */
export type CurvePoints = [CurvePoint, CurvePoint, ...CurvePoint[]];

// ============================================================================================
// screens() / sequence()
// ============================================================================================

export type ScreensItemInput<Id extends string = string> = Omit<ScreensItem, 'id'> & {id?: Id};

type MessageIn<A extends string, From extends string = A> = string extends A
  ? Omit<SeqMessage, 'from' | 'to'> & {from: A; to: A}
  // from === to is a runtime error ("use {self: id}"): spell out every ordered pair of distinct actors
  : From extends string ? Omit<SeqMessage, 'from' | 'to'> & {from: From; to: Exclude<A, From>} : never;
/** A sequence step whose participants must be declared actors. */
export type SeqStepIn<A extends string> =
  | MessageIn<A>
  | (Omit<SeqSelf, 'self'> & {self: A})
  | (Omit<SeqNote, 'over'> & {over: A | A[]})
  | SeqDivider;
export type ActorIn<A extends string> = Omit<SequenceActor, 'id'> & {id: A};

// ============================================================================================
// swimlane()
// ============================================================================================

/** A swimlane step as written: any box() field, its `size` restricted like box({size}). */
export type SwimlaneStepIn = Omit<SwimlaneStep, 'size'> & {size?: FontSize};
type UnknownKeys<T, Shape> = Exclude<keyof T, keyof Shape>;

export type LaneIds<L extends readonly {id: string}[]> = L[number]['id'];
type StepIdOf<S> = S extends {readonly id: infer I extends string} ? I : never;
export type StepIds<S extends readonly unknown[]> = StepIdOf<S[number]>;

/** swimlane-lanes: more than 6 lanes is a type error. */
export type LaneCheck<L extends readonly unknown[]> =
  number extends L['length'] ? unknown
  : L['length'] extends 1 | 2 | 3 | 4 | 5 | 6 ? unknown
  : Err<`swimlane(): ${L['length']} lanes -- at most 6 (rule swimlane-lanes). Split the process, or drop the lanes nobody hands off through.`>;

type OtherStepIds<S extends readonly unknown[], K> = {[J in keyof S]: J extends K ? never : StepIdOf<S[J]>}[number];
type StepProblem<L extends readonly {id: string}[], S extends readonly unknown[], K extends keyof S> =
  | (S[K] extends {readonly lane: infer Ln extends string}
      ? (IsPattern<Ln> extends true ? never : Ln extends LaneIds<L> ? never : `swimlane(): step uses unknown lane "${Ln}" — declared lanes: ${Join<LaneIds<L>>}`)
      : never)
  | (StepIdOf<S[K]> extends infer Id extends string
      ? ([Id] extends [never] ? never : IsPattern<Id> extends true ? never : Id extends OtherStepIds<S, K> ? `swimlane(): duplicate step id "${Id}"` : never)
      : never)
  | (UnknownKeys<S[K], SwimlaneStep> extends infer U extends string ? (U extends string ? `swimlane(): unknown step option "${U}"` : never) : never);

/** Each step's lane must be a declared lane id; step ids must be unique; no unknown keys. */
export type StepCheck<L extends readonly {id: string}[], S extends readonly unknown[]> =
  {[K in keyof S]: [StepProblem<L, S, K>] extends [never] ? unknown : Err<StepProblem<L, S, K>>};

type FlowProblem<Steps extends string, F> =
  | (F extends {readonly from: infer R extends string} ? ShapeProblem<R> | IdProblem<R, Steps> : never)
  | (F extends {readonly to: infer R extends string} ? ShapeProblem<R> | IdProblem<R, Steps> : never)
  | (F extends {readonly label: string} ? never : F extends {readonly chip: boolean} | {readonly labelAt: number} ? 'swimlane(): chip / labelAt need a label' : never);
/** Flows' from / to must be step ids (optionally ':side[@t]'). */
export type FlowCheck<Steps extends string, F extends readonly unknown[]> =
  {[K in keyof F]: [FlowProblem<Steps, F[K]>] extends [never] ? unknown : Err<FlowProblem<Steps, F[K]>>};
export type FlowIn = Omit<SwimlaneFlow, 'from' | 'to'> & {from: string; to: string};

// ============================================================================================
// stateMatrix()
// ============================================================================================

type FixedTuple<T, N extends number, Acc extends T[] = []> = Acc['length'] extends N ? Acc : FixedTuple<T, N, [...Acc, T]>;
/**
 * One row of a state matrix: EXACTLY one cell per column. An explicit `undefined` is the deliberate "TODO"
 * marker (rule wf-states-todo); a cell left out (too few) or surplus (too many, rule wf-states-ragged) is
 * a type error. Non-literal columns (`string[]`) accept any length.
 */
/** A plain stateMatrix() row as the call site hands it over (cells may be a readonly tuple); its length is checked by ValidateStateRows. */
export type StateRowLoose = {label: string; note?: string; cells: readonly StateMatrixCell[]};
/**
 * The rows handed to stateMatrix(), checked one by one (a stateRow() next to a plain row is checked too):
 *  - a stateRow() that covers fewer states than the matrix has columns names the row and the missing states;
 *  - a plain row names itself and how many cells it has against the number of columns.
 * Columns held in a plain `string[]` are not checked.
 */
export type ValidateStateRows<Cols extends readonly string[], R extends readonly unknown[]> = number extends Cols['length'] ? unknown : {
  [I in keyof R]: R[I] extends PartRow<infer K, infer L>
    ? ([Cols[number]] extends [K] ? unknown : Err<`stateRow("${L}") has no entry for the state(s): ${Join<Exclude<Cols[number], K>>}`>)
    : R[I] extends {label: infer L2 extends string; cells: infer Cl extends readonly unknown[]}
      ? ([Exclude<keyof R[I], 'label' | 'note' | 'cells'>] extends [never]
          ? (number extends Cl['length'] ? unknown : Cl['length'] extends Cols['length'] ? unknown : Err<`row "${L2}" has ${Cl['length']} cells for ${Cols['length']} columns (write undefined for a state not designed yet)`>)
          : Err<`row "${L2}" has an unknown option: ${Extract<Exclude<keyof R[I], 'label' | 'note' | 'cells'>, string>}`>)
      : unknown;
};
export type StateRowIn<Cols extends readonly string[]> = {
  label: string;
  note?: string;
  cells: number extends Cols['length'] ? StateMatrixCell[] : FixedTuple<StateMatrixCell, Cols['length']>;
};
