import { fail } from './charts-base.js';
import { must } from './must.js';
export function analyzeCriticalPath(input) {
    if (!input.length)
        fail('pert', 'needs at least one task');
    const order = new Map(), byId = new Map();
    input.forEach((t, i) => {
        if (typeof t.id !== 'string' || !t.id.trim())
            fail('pert', `tasks[${i}].id must be a non-empty string`);
        if (byId.has(t.id))
            fail('pert', `duplicate task id "${t.id}"`);
        if (typeof t.label !== 'string' || !t.label.trim())
            fail('pert', `task "${t.id}"'s label must be a non-empty string`);
        if (typeof t.duration !== 'number' || !Number.isFinite(t.duration) || t.duration < 0)
            fail('pert', `task "${t.id}"'s duration must be a finite number >= 0`);
        order.set(t.id, i);
        byId.set(t.id, t);
    });
    const pred = new Map(), succ = new Map(input.map(t => [t.id, []]));
    for (const t of input) {
        const ps = [...(t.predecessors ?? [])];
        if (new Set(ps).size !== ps.length)
            fail('pert', `task "${t.id}" repeats a predecessor`);
        for (const p of ps) {
            if (!byId.has(p))
                fail('pert', `task "${t.id}" names unknown predecessor "${p}"`);
            if (p === t.id)
                fail('pert', `cycle detected: ${t.id} -> ${t.id}`);
            must(succ.get(p)).push(t.id);
        }
        pred.set(t.id, ps);
    }
    const indegree = new Map(input.map(t => [t.id, must(pred.get(t.id)).length]));
    const ready = input.filter(t => !indegree.get(t.id)).map(t => t.id), topo = [];
    while (ready.length) {
        ready.sort((a, b) => must(order.get(a)) - must(order.get(b)));
        const id = must(ready.shift());
        topo.push(id);
        for (const n of must(succ.get(id))) {
            indegree.set(n, must(indegree.get(n)) - 1);
            if (!indegree.get(n))
                ready.push(n);
        }
    }
    if (topo.length !== input.length) {
        const cyclic = input.map(t => t.id).filter(id => must(indegree.get(id)) > 0);
        fail('pert', `cycle detected among tasks: ${cyclic.join(', ')}`);
    }
    const es = new Map(), ef = new Map();
    for (const id of topo) {
        const start = Math.max(0, ...must(pred.get(id)).map(p => must(ef.get(p))));
        es.set(id, start);
        ef.set(id, start + must(byId.get(id)).duration);
    }
    const duration = Math.max(...topo.map(id => must(ef.get(id))));
    const lf = new Map(), ls = new Map();
    for (const id of topo.toReversed()) {
        const finish = must(succ.get(id)).length ? Math.min(...must(succ.get(id)).map(s => must(ls.get(s)))) : duration;
        lf.set(id, finish);
        ls.set(id, finish - must(byId.get(id)).duration);
    }
    const tasks = input.map(t => ({ ...t, predecessors: [...must(pred.get(t.id))], es: must(es.get(t.id)), ef: must(ef.get(t.id)), ls: must(ls.get(t.id)), lf: must(lf.get(t.id)), slack: must(ls.get(t.id)) - must(es.get(t.id)), critical: Math.abs(must(ls.get(t.id)) - must(es.get(t.id))) < 1e-9 }));
    const criticalEdges = tasks.flatMap(t => t.predecessors.filter(p => must(tasks.find(x => x.id === p)).critical && t.critical && Math.abs(must(ef.get(p)) - must(es.get(t.id))) < 1e-9).map(p => ({ from: p, to: t.id })));
    // One deterministic representative path; criticalEdges still records parallel/tied paths.
    const criticalPath = [];
    let current = tasks.find(t => t.critical && t.es === 0)?.id;
    while (current) {
        criticalPath.push(current);
        current = criticalEdges.filter(e => e.from === current).sort((a, b) => must(order.get(a.to)) - must(order.get(b.to)))[0]?.to;
    }
    return { tasks, duration, criticalPath, criticalEdges };
}
