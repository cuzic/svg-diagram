import {resolveFocus} from '../focus.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {treeItems} from '../tree.ts';
import type {TreeBand, TreeItem, TreeOpts, MindmapOpts} from '../types/diagrams.ts';
import {revealOf, scopeOpt, TREE_TONES, withAnchors, withHandle} from './shared.ts';
import type {TreeIds} from './shared.ts';

/**
 * An org chart / hierarchy: the nodes place themselves (parent centred over its children, levels aligned). A node is
 * {label, sub?, id?, tone?, children?}; one with an id is an anchor for connect(), also as `t.anchors.<id>`. `{label, band, w, id?, children?}` makes the node any
 * band (ADR 0049): a chevron(), a swimlane(), a table() ..., laid out at the width `w`, the tree's lines joining its edges (its own ids are anchors too).
 *   tree({label: '社長', sub: '代表取締役', children: [{label: '開発部', id: 'dev', children: [...]}, {label: '営業部'}]}, {dir: 'down'})
 */
/**
 * "You are here" (TreeOpts.focus): a copy of the tree with every node's tone decided by where it stands to the focused nodes.
 * focused: 'solid'; under a focused node, or on the path from one up to the root: 'accent'; anywhere else: 'muted'.
 * A band node keeps its own look (it takes no tone). The input tree is not changed.
 */
function focusTree(root: TreeItem, focus: string | readonly string[], who: string): TreeItem {
  const items = treeItems(root);
  const hit = resolveFocus(focus, items.map(n => n.id), who);
  const want = new Set([...hit].map(i => items[i]));
  // returns the copy, and whether the subtree holds a focused node (its root then lies on a lit path)
  const walk = (n: TreeItem, under: boolean): [TreeItem, boolean] => {
    const self = want.has(n);
    const kids = (n.children ?? []).map(c => walk(c, under || self));
    const holds = self || kids.some(([, h]) => h);
    const tone = self ? 'solid' as const : under || holds ? 'accent' as const : 'muted' as const;
    const {tone: _written, children: _c, ...rest} = n;
    return [{...rest, ...(n.band ? {} : {tone}), ...(self || under || holds ? {focusLit: true as const} : {}), ...(n.children ? {children: kids.map(([c]) => c)} : {})}, holds];
  };
  return walk(root, false)[0];
}
export function tree<const R extends TreeItem, const Id extends string = never>(root: R, opts?: TreeOpts & {id?: Id}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
export function tree(root: TreeItem, opts: TreeOpts = {}): TreeBand {
  if (!root || typeof root !== 'object' || typeof root.label !== 'string') throw new Error('tree(root) needs a root node: {label: "...", children: [...]}');
  if (opts.focus !== undefined) root = focusTree(root, opts.focus, 'tree()');
  if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right' && opts.dir !== 'auto') throw new Error(`tree(): dir must be 'down', 'right' or 'auto' (got ${String(opts.dir)})`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW))) throw new Error(`tree(): maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
  const ids: (string | undefined)[] = [];
  if (opts.edges !== undefined && opts.edges !== false) throw new Error(`tree(): edges can only be false (no lines); got ${String(opts.edges)}`);
  const usedBands = new Set<object>();
  const walk = (n: TreeItem, parent?: TreeItem): void => {
    if (n.from !== undefined) {
      if (typeof n.from !== 'string' || !n.from) throw new Error(`tree(): "${n.label}": from is the id of a part inside the parent's band`);
      if (!parent) throw new Error(`tree(): the root has no parent, so "${n.label}" takes no from`);
      if (!parent.band) throw new Error(`tree(): "${n.label}": from names a part inside the parent's band, but "${parent.label}" is not a band node`);
      if (opts.edges === false) throw new Error(`tree(): "${n.label}": from draws a line, and edges: false draws none`);
    }
    if (n.tone !== undefined && !TREE_TONES.includes(n.tone)) throw new Error(`tree(): "${n.label}" has tone ${String(n.tone)} (use ${TREE_TONES.join(', ')})`);
    if (n.band !== undefined) {
      if (Array.isArray(n.band)) throw new Error(`tree(): "${n.label}": band got a list: swimlane() returns the band and its flows, so write swimlane(...)[0]`);
      if (typeof n.band !== 'object' || n.band === null || typeof (n.band as {type?: unknown}).type !== 'string') throw new Error(`tree(): "${n.label}": band must be a band (chevron(...), swimlane(...)[0], table(...) ...)`);
      if (usedBands.has(n.band)) throw new Error(`tree(): "${n.label}": this band is already the band of another node — a band is laid out once; build a second one (its ids would collide too)`);
      usedBands.add(n.band);
      if (n.band.type === 'connect' || n.band.type === 'spacer') throw new Error(`tree(): "${n.label}": a ${n.band.type} cannot be a node`);
      if (typeof n.w !== 'number' || !(n.w >= 40) || !Number.isFinite(n.w)) throw new Error(`tree(): "${n.label}": a band node needs its width, w: a number >= 40 (got ${String(n.w)})`);
      if (n.sub !== undefined || n.tone !== undefined) throw new Error(`tree(): "${n.label}": a band node takes no sub or tone (the band draws itself)`);
    } else if (n.w !== undefined) throw new Error(`tree(): "${n.label}": w is only for a band node`);
    ids.push(n.id);
    for (const c of n.children ?? []) walk(c, n);
  };
  walk(root);
  const band: TreeBand = {type: 'tree', root, ...(opts.focus === undefined ? {} : {focused: true as const}), ...(opts.edges === undefined ? {} : {edges: opts.edges}), ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'tree()'), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), ids);
}
/**
 * A mind map: the root in the middle, its children split to the right and the left (balanced by height, in the order
 * written: the right side first), each branch growing outward. Nodes are the same as tree()'s; `sides` pins a child of the root.
 *   mindmap({label: '新機能', children: [{label: '目的', children: [...]}, {label: '課題', id: 'issues'}]}, {sides: {issues: 'left'}})
 */
export function mindmap<const R extends TreeItem, const Id extends string = never>(root: R, opts?: MindmapOpts & {id?: Id}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
export function mindmap(root: TreeItem, opts: MindmapOpts = {}): TreeBand {
  if (opts.sides) for (const [id, side] of Object.entries(opts.sides)) if (side !== 'left' && side !== 'right') throw new Error(`mindmap(): sides.${id} must be 'left' or 'right' (got ${String(side)})`);
  const layouts = ['radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'];
  if (opts.layout !== undefined && !layouts.includes(opts.layout)) throw new Error(`mindmap(): layout must be ${layouts.join(' | ')} (got ${String(opts.layout)})`);
  if (opts.edges !== undefined && opts.edges !== false && !['elbow', 'curve', 'straight'].includes(opts.edges)) throw new Error(`mindmap(): edges must be elbow | curve | straight | false (got ${String(opts.edges)})`);
  const band = tree(opts.focus === undefined ? root : focusTree(root, opts.focus, 'mindmap()'), {...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.scope === undefined ? {} : {scope: opts.scope}), ...revealOf(opts)});
  if (opts.edges === false) for (const n of treeItems(root)) if (n.from !== undefined) throw new Error(`mindmap(): "${n.label}": from draws a line, and edges: false draws none`);
  Object.assign(band, {balanced: true, ...(opts.focus === undefined ? {} : {focused: true}), ...(opts.sides ? {sides: opts.sides} : {}), ...(opts.layout ? {layout: opts.layout} : {}), ...(opts.edges !== undefined ? {edges: opts.edges} : {})});
  return band as never;
}
