import {layoutFitRules, layoutFitVerification} from '../verify-layout-fit.ts';
import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {mindmap as buildMindmap, tree as buildTree} from '../dsl/tree.ts';
import {renderTree} from '../emit-tree.ts';
import {layoutTree} from '../layout-tree.ts';
import {treeItems, treeTexts} from '../tree.ts';
import type {LaidOutTree, MindmapOpts, TreeBand, TreeItem, TreeOpts} from '../types/diagrams.ts';
import {treeRects} from '../verify-tree.ts';

const definition = {
  type: 'tree',
  selfDimming: true,
  textSizes: texts,
  internal: true,
  layout: layoutTree,
  ids: data => treeItems(data.root).flatMap(node => node.id ? [node.id] : []),
  children: data => treeItems(data.root).flatMap(node => node.band ? [node.band] : []),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of treeTexts(data, roles)) atoms(text, size, weight, font);
  },
  emit: (laid, {theme, tones, stage}) => renderTree(laid, theme, tones, stage),
  rules: layoutFitRules,
  verify: {...layoutFitVerification, rects: treeRects},
} satisfies BandDef<TreeBand, LaidOutTree>;

export function tree<const R extends TreeItem, const Id extends string = never>(root: R, opts?: TreeOpts & {id?: Id}): WithBandDef<ReturnType<typeof buildTree<R, Id>>, LaidOutTree> {
  const data = buildTree<R, Id>(root, opts);
  return band<typeof data, LaidOutTree>(definition, data);
}

export function mindmap<const R extends TreeItem, const Id extends string = never>(root: R, opts?: MindmapOpts & {id?: Id}): WithBandDef<ReturnType<typeof buildMindmap<R, Id>>, LaidOutTree> {
  const data = buildMindmap<R, Id>(root, opts);
  return band<typeof data, LaidOutTree>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const treeDefinition: BandDef<TreeBand, LaidOutTree> = definition;
