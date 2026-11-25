import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutTree } from './types/diagrams.ts';
import type { EmphasisTone, TagTone } from './types/core.ts';
/**
 * The fill and text colours of a tree tag (ADR 0081 D4): the first row that applies, from the top: a dimmed band, a muted node,
 * a tag whose resolved colour equals the box's fill (inverted: white with the colour as its text), the plain tag (colour with white text).
 */
export declare function treeTagColors(nodeTone: EmphasisTone, tagTone: TagTone, dim: boolean | undefined, day: Theme, tones: ToneEnv): {
    fill: string;
    text: string;
};
export declare function renderTree(b: LaidOutTree, day: Theme, tones: ToneEnv, stage?: number): string;
