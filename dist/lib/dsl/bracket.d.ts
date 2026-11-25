import type { ConnectBand } from '../types/containers.ts';
import type { TextTone } from '../types/core.ts';
import type { Ok, Refers } from '../strict.ts';
import type { RevealOpts } from '../types/core.ts';
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
