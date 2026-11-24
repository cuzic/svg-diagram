import type {Json, SpecIssue} from '../spec-kit.ts';

/** Each value of `part[key]` once; a repeat is reported where it is. */
export function uniqueTexts(values: readonly unknown[], at: string, what: string, issues: SpecIssue[], key?: string): void {
  const seen = new Set<unknown>();
  values.forEach((v, i) => {
    const x = key === undefined ? v : (v as Json)[key];
    if (seen.has(x)) issues.push({path: `${at}[${i}]${key === undefined ? '' : `.${key}`}`, message: `${JSON.stringify(x)} is used twice (each ${what} needs its own name)`});
    seen.add(x);
  });
}
export const lengthIs = (v: unknown, n: number, path: string, what: string, issues: SpecIssue[]): void => {
  if (Array.isArray(v) && v.length !== n) issues.push({path, message: `has ${v.length} values; there are ${n} ${what}`});
};
