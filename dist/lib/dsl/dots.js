import { assertNoReveal, withHandle } from './shared.js';
export function dots(values, opts = {}) {
    assertNoReveal(opts, 'dots()');
    if (!Array.isArray(values) || values.length === 0)
        throw new Error('dots(values) needs at least one value');
    const min = opts.min ?? 0, max = opts.max ?? 1, r = opts.r ?? 10, TONES = ['accent', 'danger', 'muted'];
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min))
        throw new Error(`dots(): needs finite min < max (got ${min} .. ${max})`);
    if (!(r >= 2 && r <= 24))
        throw new Error(`dots(): r must be from 2 to 24 px (got ${r})`);
    for (const k of ['width', 'height']) {
        const v = opts[k];
        if (v !== undefined && !(v > 0 && Number.isFinite(v)))
            throw new Error(`dots(): ${k} must be a finite number > 0 (got ${v})`);
    }
    const list = values.map(v => typeof v === 'number' ? { at: v } : v);
    for (const v of list) {
        if (!Number.isFinite(v.at))
            throw new Error(`dots(): a value must be a finite number (got ${v.at})`);
        if (v.at < min || v.at > max)
            throw new Error(`dots(): ${v.at} is outside the lane (${min} .. ${max})`);
        if ('tone' in v && v.tone !== undefined && !TONES.includes(v.tone))
            throw new Error(`dots(): tone must be accent, danger or muted (got ${v.tone})`);
    }
    const zones = (opts.zones ?? []).map(z => ({ tone: 'danger', ...z }));
    zones.forEach((z, i) => {
        if (!(z.from >= min && z.to <= max && z.from < z.to))
            throw new Error(`dots(): zone "${z.label}" must satisfy ${min} <= from < to <= ${max}`);
        if (!TONES.includes(z.tone))
            throw new Error(`dots(): zone tone must be accent, danger or muted (got ${z.tone})`);
        if (!z.label)
            throw new Error('dots(): a zone needs a label — the colour alone does not say what it marks');
        for (const o of zones.slice(0, i))
            if (z.from < o.to && o.from < z.to)
                throw new Error(`dots(): zones "${o.label}" and "${z.label}" overlap`);
    });
    return withHandle({ type: 'dots', dots: list, min, max, lowLabel: opts.lowLabel, highLabel: opts.highLabel, zones, r, width: opts.width, height: opts.height, alt: opts.alt ?? `${list.length} dots`, ...(opts.id === undefined ? {} : { id: opts.id }) }, opts.id);
}
