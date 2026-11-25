import { andClashes } from './cause-clash.js';
import { must } from './must.js';
import { routesThroughNodes } from './verify-base.js';
export function causeFindings(band) {
    const problems = [], warnings = [];
    problems.push(...routesThroughNodes(band.edges, band.anchors, (e, n) => `cause: arrow ${e.from} -> ${e.to} runs through "${n.id}" (reorder the nodes, or change dir)`));
    // an AND's arc must cover only its own arrows, and must not touch another arc
    for (const [i, a] of band.ands.entries()) {
        const span = (p) => Math.abs(a.p0.y - a.p1.y) < 1 ? p.x : p.y; // along the arc's length
        const us = [span(a.p0), span(a.p1)].sort((p, q) => p - q), u0 = must(us[0]), u1 = must(us[1]);
        // an arrow that ends on another side of the box (a return) is not under the arc, whatever its coordinate along it: compare the other coordinate with the AND's tips
        const across = (p) => Math.abs(a.p0.y - a.p1.y) < 1 ? p.y : p.x;
        const member = band.edges.find(m => m.to === a.to && a.from.includes(m.from));
        const memberAt = member ? across(must(member.points.at(-1))) : undefined;
        for (const e of band.edges) {
            if (e.to !== a.to)
                continue;
            const tip = must(e.points.at(-1)), u = span(tip);
            if (memberAt !== undefined && Math.abs(across(tip) - memberAt) > 1)
                continue;
            const inside = u > u0 + 0.5 && u < u1 - 0.5;
            if (inside && !a.from.includes(e.from))
                problems.push(`cause: the AND arc into "${a.to}" also covers the arrow from "${e.from}" (it reads as part of the AND)`);
        }
        for (let j = i + 1; j < band.ands.length; j++) {
            const b = must(band.ands[j]);
            if (b.to !== a.to)
                continue;
            const vs = [span(b.p0), span(b.p1)].sort((p, q) => p - q), v0 = must(vs[0]), v1 = must(vs[1]);
            if (Math.min(u1, v1) - Math.max(u0, v0) > -8)
                problems.push(`cause: two AND arcs into "${a.to}" touch (they read as one AND; give them more room)`);
        }
    }
    // arrows into an effect that has an AND: two of them should not cross (a warning: it can be unavoidable) and must not run together
    // (which arrow belongs to the AND would be unclear). A crossing elsewhere is left alone: many cause graphs cannot be drawn without one.
    for (const { a, b, how } of andClashes(band.edges, band.ands)) {
        // a crossing may be unavoidable (an AND's causes in different layers around an OR cause), and long arrows can share a run: warnings
        // a negative branch tree with many side-effect branches: the narrowed / folded top-bottom figure is what crosses (ADR 0037 D4)
        const nbrHint = band.nbr?.vertical ? " NBR で枝が多いときは causeTree(..., {tree: 'nbr', dir: 'right'}) で解消することがある（ただし左右に長くなり、幅が広がることがある: diagram({width}) を広げるか、枝を 2 枚の図に分ける）" : '';
        warnings.push(`[cause-${how === 'crosses' ? 'crossing' : 'parallel'}] cause: arrow ${a.from} -> ${a.to} ${how} arrow ${b.from} -> ${b.to} (reorder the nodes, or change dir)${nbrHint}`);
    }
    for (const to of band.loose)
        problems.push(`cause: the arrows into "${to}" do not reach it on one side, so their AND arc is not drawn (an arrow of a cycle arrives from the other side: break the cycle, or split the AND)`);
    return { problems, warnings };
}
