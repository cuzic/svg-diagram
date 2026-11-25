// The viewBox geometry exposed to worksheet editors (ADR 0074 D5).
import { qualify, scopeOf } from '../scope-name.js';
const rect = ({ x, y, w, h }) => ({ x, y, w, h });
export function comicGeometry(laid) {
    const scope = scopeOf(laid);
    const name = (id) => qualify(scope, id);
    const heads = laid.panels.flatMap(p => p.heads);
    return {
        panels: Object.fromEntries(laid.panels.map(p => [name(p.id), rect(p)])),
        bubbles: Object.fromEntries(laid.bubbles.map(b => [name(b.id), rect(b)])),
        slots: Object.fromEntries(laid.bubbles.flatMap(b => b.slots.map(s => [name(s.id), rect(s)]))),
        heads: Object.fromEntries(heads.map(({ id, cx, cy, r }) => [name(id), { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }])),
        points: Object.fromEntries(heads.map(({ id, cx, cy, r, mouth }) => [name(id), { mouth: [...mouth], head: [cx, cy, r] }])),
    };
}
