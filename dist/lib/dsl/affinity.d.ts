import type { GroupRowBand } from '../types/containers.ts';
export interface AffinityGroup {
    /** The group's name (表札): what the cards in it have in common, in a short sentence. */
    title: string;
    /** The cards: one idea or fact each. */
    cards?: readonly string[];
    /** Groups inside this one (a larger group is made of smaller ones). */
    groups?: readonly AffinityGroup[];
}
export interface AffinityOpts {
    /** How many groups side by side (default 3). */
    cols?: number;
    /** How many cards side by side in a group (default 1). */
    cardCols?: number;
}
/**
 * An affinity diagram (親和図): cards of ideas or facts gathered into groups, each group named by a short sentence (its 表札), and
 * larger groups made of smaller ones. Groups sit side by side (`cols`), cards stack inside a group (`cardCols` to put them in columns).
 *   affinity([{title: '準備が足りない', cards: ['段取りが決まっていない', '資料が古い']}, {title: '連絡が遅い', groups: [{title: '社内', cards: ['報告が遅れる']}]}])
 */
export declare function affinity(groups: readonly AffinityGroup[], opts?: AffinityOpts): GroupRowBand[];
