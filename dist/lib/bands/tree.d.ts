import type { BandDef, WithBandDef } from '../band-def.ts';
import { mindmap as buildMindmap, tree as buildTree } from '../dsl/tree.ts';
import type { LaidOutTree, MindmapOpts, TreeBand, TreeItem, TreeOpts } from '../types/diagrams.ts';
export declare function tree<const R extends TreeItem, const Id extends string = never>(root: R, opts?: TreeOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildTree<R, Id>>, LaidOutTree>;
export declare function mindmap<const R extends TreeItem, const Id extends string = never>(root: R, opts?: MindmapOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildMindmap<R, Id>>, LaidOutTree>;
/** @internal Definition used by the full renderer. */
export declare const treeDefinition: BandDef<TreeBand, LaidOutTree>;
