import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutFta } from './types/diagrams.ts';
type R = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/** The outline of a gate in rectangle r (output at the top, inputs along the bottom). */
export declare function gatePath(gate: 'and' | 'or' | 'vote' | 'inhibit', r: R): string;
/** The symbol of a leaf event in rectangle r. */
export declare function markPath(kind: 'basic' | 'undeveloped' | 'house' | 'condition' | 'event', r: R): string;
/** A legend sample of a fault-tree symbol (an event's or a gate's), at the left of an item whose line is at `cy`.
 *  Sizes are multiples of 4 so the snapped arc radii still fit their chords (an arc radius below half its chord is scaled up, not drawn as asked). */
export declare function ftaLegendSwatch(it: {
    x: number;
    ftaEvent?: 'basic' | 'undeveloped' | 'house' | 'condition';
    ftaGate?: 'and' | 'or' | 'vote' | 'inhibit';
}, cy: number): string;
export declare function renderFta(b: LaidOutFta, day: Theme, tones: ToneEnv): string;
export {};
