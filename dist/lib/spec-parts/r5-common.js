/** Each value of `part[key]` once; a repeat is reported where it is. */
export function uniqueTexts(values, at, what, issues, key) {
    const seen = new Set();
    values.forEach((v, i) => {
        const x = key === undefined ? v : v[key];
        if (seen.has(x))
            issues.push({ path: `${at}[${i}]${key === undefined ? '' : `.${key}`}`, message: `${JSON.stringify(x)} is used twice (each ${what} needs its own name)` });
        seen.add(x);
    });
}
export const lengthIs = (v, n, path, what, issues) => {
    if (Array.isArray(v) && v.length !== n)
        issues.push({ path, message: `has ${v.length} values; there are ${n} ${what}` });
};
export const MAX_DAYS = 60;
/** The series of a burndown / burnup under the names a spec gives (the builder writes them in Japanese). */
export function renamed(made, names) {
    const [series, opts] = made;
    return [series.map((s, i) => ({ ...s, label: names[i] ?? s.label })), opts];
}
export const axisLabels = (part) => ({ ...(part['xLabel'] === undefined ? {} : { x: { label: part['xLabel'] } }), ...(part['yLabel'] === undefined ? {} : { y: { label: part['yLabel'] } }) });
