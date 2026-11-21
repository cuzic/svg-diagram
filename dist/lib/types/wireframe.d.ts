import type { Anchor, Rect } from './core.ts';
import type { Prim, WfCallout, WfNode, WfOverlay, WfState, WfTone } from './wireframe-nodes.ts';
export type WfFrame = 'screen' | 'light' | 'none';
/** A wireframe root: one node or several (laid out top to bottom). */
export type WfRoot = WfNode | WfNode[];
export type WfNote = string | {
    title?: string;
    text?: string;
    n?: number;
};
/** Legend labels for the new / changed outlines. */
export interface WfMarks {
    new?: string;
    changed?: string;
}
/** Fields shared by wireframe() and every screens() item. */
export interface WfScreen {
    title?: string;
    /** '新規' | '改修' | any text, drawn as a pill after the title. */
    tag?: string;
    tagTone?: WfTone;
    root: WfRoot;
    /** wf.dialog / wf.toast, drawn over the screen. One or several. */
    overlays?: WfOverlay | WfOverlay[];
    /** Screen height (default 440 / 320); 'fit' = as tall as the content. */
    h?: number | 'fit';
    frame?: WfFrame;
    /** Text becomes grey bars. */
    skeleton?: boolean;
    /** The diagram's wireframeDefaults shell: `false` leaves this screen without it; an object gives it its per-screen props (see WireframeDefaults). */
    shell?: false | WfShellProps;
}
/** Per-screen input of the diagram's shell: which nav item is selected, a different title, anything a custom `shell` function reads. */
export interface WfShellProps {
    /** appbar shell: the selected nav item, by label or by index. */
    active?: string | number;
    /** appbar shell: replaces the appbar's title for this screen. */
    title?: string;
    [key: string]: unknown;
}
/** diagram({wireframeDefaults}): what every wireframe() / screens() item starts from. A field set on the screen wins. */
export interface WireframeDefaults {
    /** The app's top bar, put above every screen's content: `{title, nav, right}` as wf.appbar(); a screen's `shell: {active}` selects the nav item. */
    appbar?: {
        title: string;
        nav?: string[];
        right?: string[];
    };
    /** The general form: wraps each screen's content (any structure). Runs after / instead of `appbar`. */
    shell?: (content: WfNode[], props: WfShellProps) => WfRoot;
    h?: number | 'fit';
    frame?: WfFrame;
    skeleton?: boolean;
    tag?: string;
    tagTone?: WfTone;
}
export interface WireframeOpts extends Omit<WfScreen, 'root'> {
    id?: string;
    notes?: WfNote[];
    noteW?: number;
    marks?: WfMarks;
}
export interface WireframeBand extends WireframeOpts {
    type: 'wireframe';
    root: WfRoot;
}
export interface ScreensItem extends WfScreen {
    /** Makes the screen a connect() anchor. */
    id?: string;
    /** [row, col]; col may be fractional (0.5 = half a column in). */
    at?: [number, number];
}
export interface ScreensOpts {
    /** Columns (default 3, or derived from `at`). */
    cols?: number;
    gap?: number;
    rowGap?: number;
    /** Default item height (320). */
    h?: number | 'fit';
    skeleton?: boolean;
    marks?: WfMarks;
    id?: string;
}
/** One cell of a state matrix: a node, 'na' / {na: reason} (not applicable), or missing / 'todo' (未設計). */
export type StateMatrixCell = WfNode | 'na' | 'todo' | {
    na: string;
} | undefined;
export interface StateMatrixRow {
    label: string;
    note?: string;
    /** Mutated by layout: padded with undefined up to the number of columns. */
    cells: StateMatrixCell[];
}
/** What one state of a stateRow() holds: the options that differ from the part's base, a bare WfState, or one of the plain cell forms. */
export type StateCellIn<O> = Partial<O> | WfState | 'na' | 'todo' | {
    na: string;
} | undefined;
/** stateRow() result: one part drawn once per state. `K` = the state columns it covers (carried only by the type). */
export interface PartRow<K extends string = string, L extends string = string> {
    type: 'part-row';
    label: string;
    note?: string;
    /** Cells for these columns, in order. Throws on a state that is not a column. */
    cells(cols: readonly string[]): StateMatrixCell[];
    /** Contravariant: a row covering MORE states than the matrix has columns is fine, one covering fewer is a type error. */
    readonly '~cols'?: (c: K) => void;
    /** The row's label as a literal type, so a type error can name the row. */
    readonly '~label'?: L;
}
export interface StateMatrixOpts {
    /** Columns that must exist (checked by the wf-states-required rule). */
    required?: string[];
    labelW?: number;
    /** Cell height (default: fit the content, min 72). */
    cellH?: number;
    gap?: number;
    /** 'light' (default) | 'none' when the parts already have their own border. */
    cellFrame?: 'light' | 'none';
    marks?: WfMarks;
    skeleton?: boolean;
    id?: string;
}
export interface StateMatrix {
    cols: string[];
    rows: StateMatrixRow[];
    required?: string[];
    labelW?: number;
    cellH?: number;
    gap?: number;
    cellFrame?: 'light' | 'none';
}
/** screens() and stateMatrix() both return this; a state matrix has `matrix` set and no items. */
export interface ScreensBand extends ScreensOpts {
    type: 'screens';
    items: ScreensItem[];
    matrix?: StateMatrix;
}
/** wireframe() as laid out: flat primitives + the callouts drawn (for the order rule). */
export interface LaidOutWireframe extends Rect {
    type: 'wireframe';
    id?: string;
    title?: string;
    prims: Prim[];
    callouts: WfCallout[];
    /** The screen frame, as a connect() anchor (only when the wireframe has an id). */
    anchors: Anchor[];
}
export interface LaidOutScreens extends Rect {
    type: 'screens';
    id?: string;
    title?: string;
    prims: Prim[];
    /** One per screen with an id (state-matrix cells get none and keep id-less rects: see layout). */
    anchors: Anchor[];
}
