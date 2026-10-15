// ADR 0012: the name helpers every layer shares (leaf module: no imports, so a band constructor can use it without a cycle).

/** The scope a band (input or laid out) was built with. */
export const scopeOf = (b: object): string | undefined => {
  const s = (b as {scope?: unknown}).scope;
  return typeof s === 'string' && s !== '' ? s : undefined;
};

/** The registered name of an item: `scope.id`, or the bare id when the band has no scope. */
export const qualify = (scope: string | undefined, id: string): string => scope ? `${scope}.${id}` : id;

/** A scope is a plain name: it cannot hold the characters the reference syntax or a row column use (`:` `@` `#`), a dot or a blank. */
export function assertScope(scope: unknown, what: string): void {
  if (scope === undefined) return;
  if (typeof scope !== 'string' || !/^[^\s:@#.]+$/.test(scope)) throw new Error(`${what}: scope must be a non-empty name without blanks or any of : @ # . (got ${JSON.stringify(scope)})`);
}
