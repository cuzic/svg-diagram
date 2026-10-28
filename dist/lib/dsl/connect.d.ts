import type { ConnectBand } from '../types/containers.ts';
import type { TextTone } from '../types/core.ts';
import type { BranchInput, ConnectInput, Ok, Refers } from '../strict.ts';
import type { RevealOpts } from '../types/core.ts';
export declare function connect<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: ConnectInput): ConnectBand & Refers<F | T>;
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
export declare function bracket<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: BracketOpts): ConnectBand & Refers<F | T>;
export interface CalloutOpts extends RevealOpts {
    /** The text of the bubble (one line). */
    text: string;
    /** Which side of the target the bubble is on (default 'above'). */
    side?: 'above' | 'below' | 'left' | 'right';
    tone?: TextTone;
}
/** A bubble with a leader line pointing at a box: `callout('slow', {text: '344ms かかる', side: 'below'})`. Put the target's id or 'id:side'. */
export declare function callout<const T extends string>(target: Ok<T>, opts: CalloutOpts): ConnectBand & Refers<T>;
export declare function branch<const F extends string, const To extends string>(from: Ok<F>, targets: (BranchInput & {
    to: Ok<To>;
})[], opts?: BranchInput): (ConnectBand & Refers<F | To>)[];
