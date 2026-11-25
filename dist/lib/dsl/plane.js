import { LABEL_ROLES } from '../tokens.js';
import { assertTextRole, withHandle } from './shared.js';
export function plane(opts) {
    assertTextRole(opts?.labelRole, LABEL_ROLES, 'plane() labelRole');
    for (const k of ['x', 'y']) {
        const a = opts?.[k];
        if (a && a.step !== undefined && !(a.step > 0 && Number.isFinite(a.step)))
            throw new Error(`plane(): axis ${k} step must be a number > 0 (got ${a.step})`);
        if (!a || typeof a.max !== 'number')
            throw new Error(`plane(): "${k}" needs an axis, e.g. {max: 100}`);
        if (a.max <= (a.min ?? 0))
            throw new Error(`plane(): axis ${k} needs max > min`);
        if (a.categories !== undefined) {
            const c = a.categories;
            if (!Array.isArray(c) || !c.length || c.some(s => typeof s !== 'string' || !s))
                throw new Error(`plane(): axis ${k} categories must be a non-empty list of names, e.g. ['営業', '開発']`);
            if (a.ticks !== undefined || a.step !== undefined)
                throw new Error(`plane(): axis ${k} takes categories or ticks / step, not both (the categories are its ticks)`);
            if ((a.min ?? 0) >= 1 || a.max < c.length)
                throw new Error(`plane(): axis ${k} puts its ${c.length} categories at 1..${c.length}, so it needs min < 1 and max >= ${c.length} (use max: ${c.length + 1})`);
        }
    }
    if (opts.stages !== undefined) {
        const st = opts.stages, name = (q) => typeof q === 'string' ? q : q?.name;
        if (!Array.isArray(st) || st.length < 2 || st.some(q => typeof name(q) !== 'string' || !name(q)))
            throw new Error("plane(): stages must be a list of at least 2 names (or {name, to?}), e.g. ['起源', 'カスタム', '製品', 'コモディティ']");
        if (opts.x.ticks !== undefined || opts.x.step !== undefined || opts.x.categories !== undefined)
            throw new Error('plane(): stages are the x axis ticks, so x takes no ticks / step / categories with them');
        const tos = st.map(q => typeof q === 'string' ? undefined : q.to);
        if (tos.some(t => t !== undefined)) {
            const min = opts.x.min ?? 0, inner = tos.slice(0, -1);
            if (tos[tos.length - 1] !== undefined)
                throw new Error("plane(): the last stage runs to the end of the x axis, so it takes no `to`");
            if (inner.some(t => typeof t !== 'number' || !Number.isFinite(t)))
                throw new Error('plane(): when a stage says where it ends (`to`), every stage but the last must');
            if (inner.some((t, i) => t <= (i ? inner[i - 1] : min) || t >= opts.x.max))
                throw new Error('plane(): stage `to` values must increase and stay inside the x axis');
        }
    }
    for (const p of opts.points ?? [])
        if (p.evolves) {
            const to = p.evolves.to, min = opts.x.min ?? 0;
            if (typeof to !== 'number' || !(to > p.at[0]) || to > opts.x.max || to < min)
                throw new Error(`plane(): a point's evolves.to must be a number right of the point (x ${p.at[0]}) and inside the x axis (got ${to})`);
        }
    return withHandle({ type: 'plane', ...opts, height: opts.height ?? 300 }, opts.id);
}
