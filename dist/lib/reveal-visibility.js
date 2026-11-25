export function checked(value, where) {
    if (value === undefined)
        return undefined;
    if (!Number.isInteger(value) || value < 1)
        throw new Error(`${where}: reveal must be a whole number >= 1 (got ${value})`);
    return value;
}
export const visibleAt = (x, stage) => stage === undefined || ((x.reveal ?? 0) <= stage && (x.until === undefined || stage < x.until));
