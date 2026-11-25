import type { ConnectBand } from '../types/containers.ts';
import type { TextTone } from '../types/core.ts';
import type { Ok, Refers } from '../strict.ts';
import type { RevealOpts } from '../types/core.ts';
export interface CalloutOpts extends RevealOpts {
    /** The text of the bubble (one line). */
    text: string;
    /** Which side of the target the bubble is on (default 'above'). */
    side?: 'above' | 'below' | 'left' | 'right';
    tone?: TextTone;
}
/** A bubble with a leader line pointing at a box: `callout('slow', {text: '344ms かかる', side: 'below'})`. Put the target's id or 'id:side'. */
export declare function callout<const T extends string>(target: Ok<T>, opts: CalloutOpts): ConnectBand & Refers<T>;
