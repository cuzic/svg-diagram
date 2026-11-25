export function checked(value: number | undefined, where: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${where}: reveal must be a whole number >= 1 (got ${value})`);
  return value;
}

export const visibleAt = (x: object & {reveal?: number; until?: number}, stage: number | undefined): boolean =>
  stage === undefined || ((x.reveal ?? 0) <= stage && (x.until === undefined || stage < x.until));
