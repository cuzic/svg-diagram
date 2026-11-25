import {text} from '../spec-kit.ts';
import type {Json, JsonSchema, SpecIssue} from '../spec-kit.ts';

export const UNIT = text("Written after every value, such as '万円', '%' or 'mm'.", 10);
export const COUNT: JsonSchema = {type: 'integer', minimum: 0, maximum: 1_000_000, description: 'A count, a whole number 0 or more.'};
/** The legend's cross: the fonts of a Worker have × but no ✕. */
export const CROSS = '×';
/** Raw measurements a chart works its statistics out of. */
export const MAX_VALUES = 300;

export function uniqueLabels(entries: readonly Json[], at: string, what: string, issues: SpecIssue[]): void {
  const seen = new Set<unknown>();
  entries.forEach((e, i) => {
    if (seen.has(e['label'])) issues.push({path: `${at}[${i}].label`, message: `"${String(e['label'])}" is used twice (each ${what} needs its own label)`});
    seen.add(e['label']);
  });
}
export const notDefined = (part: Json, keys: readonly string[]): string[] => keys.filter(k => part[k] !== undefined);

/** The data a control chart takes, by kind of chart. */
export const CONTROL_DATA: Record<string, 'values' | 'subgroups' | 'samples'> = {x: 'values', mr: 'values', c: 'values', xbar: 'subgroups', r: 'subgroups', p: 'samples', np: 'samples', u: 'samples'};
