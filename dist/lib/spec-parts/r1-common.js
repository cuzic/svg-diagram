import { oneOf, text } from '../spec-kit.js';
export const UNIT = text("Written after every value, such as '万円', '%' or '件'.", 10);
export const BAR_TONE = oneOf('accent', 'danger', 'muted');
export const DIR = (what) => ({ ...oneOf('v', 'h'), description: `v: ${what} stand side by side and rise. h: they run left to right, one per row (for long labels).` });
/** Labels that repeat in `list` are reported at the second one. */
export function uniqueLabels(entries, at, what, issues, key = 'label') {
    const seen = new Set();
    entries.forEach((e, i) => {
        if (seen.has(e[key]))
            issues.push({ path: `${at}[${i}].${key}`, message: `"${String(e[key])}" is used twice (each ${what} needs its own ${key})` });
        seen.add(e[key]);
    });
}
export const nums = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'number') : [];
