// A resolve hook that makes the modules named in SVG_DIAGRAM_TEST_BLOCK (comma-separated) impossible to import, as when a
// package is not installed or has no binary for this machine.
export async function resolve(specifier: string, context: unknown, next: (s: string, c: unknown) => Promise<unknown>) {
  const blocked = (process.env['SVG_DIAGRAM_TEST_BLOCK'] ?? '').split(',').filter(Boolean);
  if (blocked.includes(specifier)) {
    const e = new Error(`Cannot find package '${specifier}' imported from ${(context as {parentURL?: string}).parentURL}`) as Error & {code: string};
    e.code = 'ERR_MODULE_NOT_FOUND';
    throw e;
  }
  return next(specifier, context);
}
