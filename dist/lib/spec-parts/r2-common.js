import { text } from '../spec-kit.js';
export const unit = (description = "Written after every number ('万円', '%').") => text(description, 10);
export const isNum = (v) => typeof v === 'number';
/** A value that must be above 0 (an area, a thickness): the schema allows 0, this reports it at its place. */
export function positive(v, path, what, issues) {
    if (isNum(v) && !(v > 0))
        issues.push({ path, message: `${what} must be more than 0 (got ${v})` });
}
/** `min` below `max` when both are given. */
export function minBelowMax(o, at, issues) {
    if (o && isNum(o['min']) && isNum(o['max']) && !(o['min'] < o['max']))
        issues.push({ path: `${at}.max`, message: `must be more than min (${o['min']})` });
}
