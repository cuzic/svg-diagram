export const fmt = (n) => String(parseFloat(n.toPrecision(3)));
function niceStep(range) {
    const raw = range / 6, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
    return mag * (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10);
}
export function ticksOf(axis, caller = 'plane') {
    if (axis.categories)
        return axis.categories.map((label, i) => ({ at: i + 1, label }));
    if (axis.ticks)
        return axis.ticks.map(t => typeof t === 'number' ? { at: t, label: fmt(t) } : t);
    const min = axis.min ?? 0, step = axis.step ?? niceStep(axis.max - min), out = [];
    if (!(step > 0) || !Number.isFinite(step))
        throw new Error(`${caller}(): an axis step must be a number > 0 (got ${axis.step})`);
    for (let v = min, i = 0; v <= axis.max + step * 1e-9 && i < 200; v = min + ++i * step)
        out.push({ at: v, label: fmt(v) });
    return out;
}
