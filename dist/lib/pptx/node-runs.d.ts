import { type ToneEnv } from '../tokens.ts';
import type { LaidOutTree, TreeNodeText } from '../types/diagrams.ts';
import type { WrappedRun } from '../types/text-bands.ts';
import type { Rect } from './xml.ts';
/** The shared text inset of tree, cause and state nodes. */
export declare const NODE_TEXT_PAD_Y = 8;
/** A node's lines as runs: consecutive lines of the same size, weight and colour are one run, at the baselines the layout gave. */
export declare function nodeRunsOf(n: Rect & {
    tone: LaidOutTree['nodes'][number]['tone'];
}, texts: readonly TreeNodeText[], tones: ToneEnv): WrappedRun[];
