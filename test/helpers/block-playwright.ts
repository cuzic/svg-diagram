// A resolve hook that makes `playwright-chromium` impossible to import, as in a project that never installed it. Used through
// `node --import test/helpers/block-playwright-register.ts` in a child process.
export async function resolve(specifier: string, context: unknown, next: (s: string, c: unknown) => Promise<unknown>) {
  if (specifier === 'playwright-chromium') {
    const e = new Error(`Cannot find package 'playwright-chromium' imported from ${(context as {parentURL?: string}).parentURL}`) as Error & {code: string};
    e.code = 'ERR_MODULE_NOT_FOUND';
    throw e;
  }
  return next(specifier, context);
}
