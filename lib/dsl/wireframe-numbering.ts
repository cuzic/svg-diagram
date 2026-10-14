import {wf} from '../wireframe.ts';
import {num} from '../qc.ts';
import type {Band} from '../types/index.ts';
import type {WfNode, WfOverlay, WfPartKey} from '../types/wireframe-nodes.ts';
import type {ScreensBand, WfRoot, WfScreen, WfShellProps, WireframeBand, WireframeDefaults} from '../types/wireframe.ts';
import {cloneBand, mapBands} from './shared.ts';

// `n: true` (on a node, on a part in `parts: {...}`, or on a map marker) means "number me": such callouts get consecutive
// numbers in reading order (top to bottom, left to right), continuing after any explicit numbers.
export interface Numbering {
  /** One per `n: true` found, in reading order: each writes the number it is given back into its callout. */
  todo: ((n: number) => void)[];
  /** The largest number written explicitly. */
  max: number;
}
export const NUMBERING = Symbol('wireframe-numbering'); // on a wireframe band: its Numbering, so a diagram shell can number ITS callouts first
export type NumberTrees = (WfRoot | WfOverlay | WfOverlay[] | undefined)[];
/** `skip`: nodes that are not walked (nor descended into) — used to number only a shell, not the content it wraps. */
export function collectNumbering(skip: Set<object> | null, trees: NumberTrees): Numbering {
  const todo: Numbering['todo'] = [];
  let max = 0;
  const num = (v: unknown) => { if (typeof v === 'number') max = Math.max(max, v); };
  const walk = (nd: WfNode | WfNode[] | undefined | null): void => {
    if (!nd || typeof nd !== 'object') return;
    if (Array.isArray(nd)) return nd.forEach(c => walk(c));
    if (!nd.t || skip?.has(nd)) return;
    const node = nd;
    if (node.n === true) todo.push(v => { node.n = v; }); else num(node.n);
    const parts = node.parts;
    if (parts) for (const [k, v] of Object.entries(parts)) { if (v === true) todo.push(nv => { parts[k as WfPartKey] = nv; }); else num(v); }
    if (node.t === 'map') for (const m of node.markers ?? []) { if (m.n === true) todo.push(v => { m.n = v; }); else num(m.n); }
    walk('children' in node ? node.children : undefined);
  };
  trees.forEach(t => walk(t as WfNode | WfNode[] | undefined));
  return {todo, max};
}
export const assignNumbers = (max: number, ...groups: Numbering['todo'][]): void => { let next = max + 1; for (const g of groups) for (const set of g) set(next++); };
export function autoNumber(...trees: NumberTrees): Numbering {
  const nm = collectNumbering(null, trees);
  assignNumbers(nm.max, nm.todo);
  return nm;
}
/** Every node of a tree (so a shell can tell its own nodes from the content's). */
export function nodesOf(root: WfRoot): Set<object> {
  const out = new Set<object>();
  const walk = (nd: unknown): void => {
    if (!nd || typeof nd !== 'object') return;
    if (Array.isArray(nd)) return nd.forEach(walk);
    out.add(nd);
    walk((nd as {children?: unknown}).children);
  };
  walk(root);
  return out;
}
// diagram({wireframeDefaults}): fill the screen fields a wireframe() / screens() item leaves out, and wrap its content in the shell.
// The result is a copy; a copy made here is never wrapped again (adding it to a diagram a second time is safe). `n: true` callouts
// of the shell are numbered BEFORE the content's auto-numbered ones (the shell is on top of the screen); that renumbers the
// content's auto numbers, which are written into the content nodes themselves — only when the shell has such callouts.
export const SHELLED = new WeakSet<object>();
export function applyWireframeDefaults(bands: Band[], defaults: WireframeDefaults): Band[] {
  const apply = <S extends WfScreen & {id?: string}>(orig: S, numbering?: Numbering): S => {
    if (SHELLED.has(orig)) return orig;
    const screen = cloneBand(orig);
    SHELLED.add(screen);
    const s = screen as unknown as Record<string, unknown>;
    for (const k of ['h', 'frame', 'skeleton', 'tag', 'tagTone'] as const) if (s[k] === undefined && defaults[k] !== undefined) s[k] = defaults[k];
    if (screen.shell === false) return screen;
    const props: WfShellProps = screen.shell ?? {};
    const own = nodesOf(orig.root);
    let content = [orig.root].flat() as WfNode[];
    if (defaults.appbar) {
      const {title, nav, right} = defaults.appbar;
      let active: number | undefined;
      if (typeof props.active === 'string') {
        active = (nav ?? []).indexOf(props.active);
        if (active < 0) throw new Error(`wireframeDefaults.appbar: "${props.active}" is not one of the nav items (${(nav ?? []).join(', ')})`);
      } else active = props.active;
      content = [wf.appbar(props.title ?? title, {nav, right, active}), ...content];
    }
    if (defaults.shell) content = [defaults.shell(content, props)].flat() as WfNode[];
    screen.root = content.length === 1 ? content[0] : content;
    if (numbering) {
      const shellNumbers = collectNumbering(own, [screen.root]);
      if (shellNumbers.todo.length) assignNumbers(Math.max(numbering.max, shellNumbers.max), shellNumbers.todo, numbering.todo);
    } else autoNumber(screen.root, screen.overlays);
    return screen;
  };
  return mapBands(bands, b => {
    if (b.type === 'wireframe') return apply(b as WireframeBand, (b as unknown as {[NUMBERING]?: Numbering})[NUMBERING]);
    if (b.type === 'screens') {
      const sc = b as ScreensBand, items = sc.items.map(it => apply(it));
      return items.some((it, i) => it !== sc.items[i]) ? Object.assign(cloneBand(sc), {items}) : undefined;
    }
    return undefined;
  });
}
