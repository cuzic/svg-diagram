import { qualify, scopeOf } from './scope-name.js';
import { bareNameIn } from './scope-table.js';
import { rectOverlap } from './verify-base.js';
export function comicSlotOwners(band) {
    const owners = new Map();
    for (const bubble of band.bubbles)
        for (const { id } of bubble.slots) {
            // Layout registers only the first anchor when a worksheet repeats a slot id.
            if (!owners.has(id))
                owners.set(id, bubble);
        }
    return owners;
}
export function comicRects(band) {
    const scope = scopeOf(band), owners = comicSlotOwners(band);
    return band.panels.map(({ id, x, y, w, h }) => {
        const holds = band.id ? [band.id] : [];
        for (const [slot, bubble] of owners)
            if (bubble.panel === id)
                holds.push(qualify(scope, slot));
        return { id: qualify(scope, id), label: `comic panel ${id}`, x, y, w, h, holds };
    });
}
export function comicConnectorProblems(band, connects) {
    const problems = [];
    if (!connects.length)
        return problems;
    const scope = scopeOf(band), owners = comicSlotOwners(band);
    for (const c of connects) {
        const fromId = bareNameIn(scope, c.fromId), toId = bareNameIn(scope, c.toId);
        const from = fromId === undefined ? undefined : owners.get(fromId), to = toId === undefined ? undefined : owners.get(toId);
        if (!from && !to)
            continue;
        // Other panels are checked by their frames. Inside the endpoint panels, check the bubbles individually.
        for (const b of band.bubbles) {
            if (b.panel !== from?.panel && b.panel !== to?.panel)
                continue;
            if (b === from || b === to || b.id === fromId || b.id === toId)
                continue;
            if (c.segments.some(seg => rectOverlap(seg, b))) {
                problems.push(`connect(${c.fromLabel ?? c.fromId} -> ${c.toLabel ?? c.toId}) の経路がふきだし "${qualify(scope, b.id)}" に重なります。接続の辺か経路を変えてください`);
            }
        }
    }
    return problems;
}
