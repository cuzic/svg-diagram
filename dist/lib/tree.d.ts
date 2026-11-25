import type { FontFamily, Roles, TagTone, WidthOf, WrapEnv, WrapMode } from './types/core.ts';
import type { LaidOutTree, TreeBand, TreeItem, TreeNodeText } from './types/diagrams.ts';
import type { Band } from './types/index.ts';
/** Every item of a tree in drawing order (a parent before its children). */
export declare function treeItems(root: TreeItem): TreeItem[];
/** Every string a tree draws, registered before its geometry is calculated. */
export declare function treeTexts(band: TreeBand, roles: Roles): [string, number, number, FontFamily][];
/** A node's tags as written (ADR 0081 D4), each with its tone settled (a plain string is an accent tag). */
export interface TreeTag {
    text: string;
    tone: TagTone;
}
export declare function treeTags(n: TreeItem): TreeTag[];
/** The sizes of a tree tag at the diagram's tag text size `f` (roles.tag, default 14): everything scales with s = f / 14. */
export declare function tagMetrics(roles: Roles): {
    f: number;
    h: number;
    base: number;
    padX: number;
    gap: number;
    below: number;
};
/** `tagRowH`: the height the node's tag row takes at the top (0: no tags); `tagRow`: the tags with their widths. */
export interface NodeLines {
    label: string[];
    sub: string[];
    w: number;
    h: number;
    tagRowH?: number;
    tagRow?: (TreeTag & {
        w: number;
    })[];
}
/** The wrapped texts (each a list of lines) that broke into several lines of 2.5 characters or fewer on average: what `fit: 'shrink'` squeezing a column too far does (rule shrink-narrow-text). Returns the joined texts, each once. */
export declare function narrowTexts(texts: string[][]): string[];
/** `{narrow}` for a laid-out band, or nothing when no text broke that way (so a shrink that changed nothing leaves the band as it was). */
export declare function narrowField(texts: string[][]): {
    narrow?: string[];
};
/** A node's text wrapped to maxW, and the box size it needs (bold label, muted sub line). Shared with states(). */
/** The widest katakana word of a text: a run of the characters `phrase` keeps whole (wrap.ts scriptRun: katakana with ー and ・, and half-width kana). */
export declare function katakanaWidth(text: string, widthOf: WidthOf, size: number, weight: 400 | 700): number;
/** `mode`: the diagram's wrap mode; `floor`: whether the keepWords floor applies to this measurement (the diagram's keepWords, or the fit attempt's: see fitLayout). */
export declare function measureNode(label: string, sub: string | undefined, maxW: number, widthOf: WidthOf, roles: Roles, mode: WrapMode, floor: boolean, opts?: {
    keepWordsCap?: number; /** false: this node is not given the floor (a round node, a cloud's fixed column). */
    keepWords?: boolean; /** ADR 0081: the tags of this node (a row at the top; the box only widens for it). */
    tags?: readonly TreeTag[];
}): NodeLines;
/** The centred text runs of a node laid in rectangle r. */
export declare function nodeRuns(r: {
    x: number;
    y: number;
    w: number;
}, l: NodeLines, roles: Roles): TreeNodeText[];
export declare function layoutTreeBand(band: TreeBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, /** The height a band node takes at a width (the layout shell measures it); without it a band node throws. */ bandHeight?: (band: Band, w: number) => number): LaidOutTree;
