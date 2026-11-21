import { wf } from '../wireframe.js';
import { cloneBand, mapBands } from './shared.js';
export const NUMBERING = Symbol('wireframe-numbering'); // on a wireframe band: its Numbering, so a diagram shell can number ITS callouts first
/** `skip`: nodes that are not walked (nor descended into) — used to number only a shell, not the content it wraps. */
export function collectNumbering(skip, trees) {
    const todo = [];
    let max = 0;
    const num = (v) => { if (typeof v === 'number')
        max = Math.max(max, v); };
    const walk = (nd) => {
        if (!nd || typeof nd !== 'object')
            return;
        if (Array.isArray(nd)) {
            nd.forEach(c => walk(c));
            return;
        }
        if (!nd.t || skip?.has(nd))
            return;
        const node = nd;
        if (node.n === true)
            todo.push(v => { node.n = v; });
        else
            num(node.n);
        const parts = node.parts;
        if (parts)
            for (const [k, v] of Object.entries(parts)) {
                if (v === true)
                    todo.push(nv => { parts[k] = nv; });
                else
                    num(v);
            }
        if (node.t === 'map')
            for (const m of node.markers ?? []) {
                if (m.n === true)
                    todo.push(v => { m.n = v; });
                else
                    num(m.n);
            }
        walk('children' in node ? node.children : undefined);
    };
    trees.forEach(t => walk(t));
    return { todo, max };
}
export const assignNumbers = (max, ...groups) => { let next = max + 1; for (const g of groups)
    for (const set of g)
        set(next++); };
export function autoNumber(...trees) {
    const nm = collectNumbering(null, trees);
    assignNumbers(nm.max, nm.todo);
    return nm;
}
/** Every node of a tree (so a shell can tell its own nodes from the content's). */
export function nodesOf(root) {
    const out = new Set();
    const walk = (nd) => {
        if (!nd || typeof nd !== 'object')
            return;
        if (Array.isArray(nd)) {
            nd.forEach(walk);
            return;
        }
        out.add(nd);
        walk(nd.children);
    };
    walk(root);
    return out;
}
// diagram({wireframeDefaults}): fill the screen fields a wireframe() / screens() item leaves out, and wrap its content in the shell.
// The result is a copy; a copy made here is never wrapped again (adding it to a diagram a second time is safe). `n: true` callouts
// of the shell are numbered BEFORE the content's auto-numbered ones (the shell is on top of the screen); that renumbers the
// content's auto numbers, which are written into the content nodes themselves — only when the shell has such callouts.
export const SHELLED = new WeakSet();
export function applyWireframeDefaults(bands, defaults) {
    const apply = (orig, numbering) => {
        if (SHELLED.has(orig))
            return orig;
        const screen = cloneBand(orig);
        SHELLED.add(screen);
        const s = screen;
        for (const k of ['h', 'frame', 'skeleton', 'tag', 'tagTone'])
            if (s[k] === undefined && defaults[k] !== undefined)
                s[k] = defaults[k];
        if (screen.shell === false)
            return screen;
        const props = screen.shell ?? {};
        const own = nodesOf(orig.root);
        let content = [orig.root].flat();
        if (defaults.appbar) {
            const { title, nav, right } = defaults.appbar;
            let active;
            if (typeof props.active === 'string') {
                active = (nav ?? []).indexOf(props.active);
                if (active < 0)
                    throw new Error(`wireframeDefaults.appbar: "${props.active}" is not one of the nav items (${(nav ?? []).join(', ')})`);
            }
            else
                active = props.active;
            content = [wf.appbar(props.title ?? title, { nav, right, active }), ...content];
        }
        if (defaults.shell)
            content = [defaults.shell(content, props)].flat();
        const [only] = content;
        screen.root = content.length === 1 && only ? only : content;
        if (numbering) {
            const shellNumbers = collectNumbering(own, [screen.root]);
            if (shellNumbers.todo.length)
                assignNumbers(Math.max(numbering.max, shellNumbers.max), shellNumbers.todo, numbering.todo);
        }
        else
            autoNumber(screen.root, screen.overlays);
        return screen;
    };
    return mapBands(bands, b => {
        if (b.type === 'wireframe')
            return apply(b, b[NUMBERING]);
        if (b.type === 'screens') {
            const sc = b, items = sc.items.map(it => apply(it));
            return items.some((it, i) => it !== sc.items[i]) ? Object.assign(cloneBand(sc), { items }) : undefined;
        }
        return undefined;
    });
}
