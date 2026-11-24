import {oneOf, text} from '../spec-kit.ts';
import type {Json, JsonSchema, SpecIssue} from '../spec-kit.ts';

export const UNIT = text("Written after every value, such as '万円', '%' or '件'.", 10);
export const BAR_TONE = oneOf('accent', 'danger', 'muted');
export const DIR = (what: string): JsonSchema => ({...oneOf('v', 'h'), description: `v: ${what} stand side by side and rise. h: they run left to right, one per row (for long labels).`});

/** Labels that repeat in `list` are reported at the second one. */
export function uniqueLabels(entries: readonly Json[], at: string, what: string, issues: SpecIssue[], key = 'label'): void {
  const seen = new Set<unknown>();
  entries.forEach((e, i) => {
    if (seen.has(e[key])) issues.push({path: `${at}[${i}].${key}`, message: `"${String(e[key])}" is used twice (each ${what} needs its own ${key})`});
    seen.add(e[key]);
  });
}
export const nums = (v: unknown): number[] => Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
