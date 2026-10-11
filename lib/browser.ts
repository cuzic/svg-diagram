// The one place that reaches for a browser. playwright-chromium is an optional peer dependency: nothing that lays out or builds a
// diagram needs it, only the checks that look at a real rendering (`lint --engine browser`, `build --lint` through it),
// slide-budget (the free area of a Slidev slide) and `--engine chromium` options. It is imported here, on demand, so a project
// that never asks for a browser never has to download one.
import type {Browser, LaunchOptions} from 'playwright-chromium';

export const BROWSER_HINT = `playwright-chromium is not installed, and this needs a browser.
  Add it:      pnpm add -D playwright-chromium   (pnpm 10+ also asks to allow its install script: pnpm approve-builds)
  Then fetch:  pnpm exec playwright install chromium
  (The layout, build and the default checks need no browser.)`;

const notFound = (e: unknown) => {
  const err = e as {code?: string; message?: string};
  return (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') && /playwright-chromium/.test(err.message ?? '');
};

export async function launchChromium(options?: LaunchOptions): Promise<Browser> {
  let chromium: typeof import('playwright-chromium').chromium;
  try { ({chromium} = await import('playwright-chromium')); }
  catch (e) { if (notFound(e)) throw new Error(BROWSER_HINT); throw e; }
  try { return await chromium.launch(options); }
  catch (e) {
    if (/Executable doesn't exist/.test((e as Error).message)) throw new Error(`playwright-chromium is installed but its browser was not downloaded.\n  Fetch it:  pnpm exec playwright install chromium\n\n${(e as Error).message}`);
    throw e;
  }
}
