// The one place that reaches for a browser. playwright-chromium is an optional peer dependency: nothing that lays out or builds a
// diagram needs it, only the checks that look at a real rendering (`lint --engine browser`, `build --lint` through it),
// slide-budget (the free area of a Slidev slide) and `--engine chromium` options. It is imported here, on demand, so a project
// that never asks for a browser never has to download one.
import type {Browser, LaunchOptions} from 'playwright-chromium';
import {findChromium, launchCdp} from './cdp-browser.ts';

export const BROWSER_HINT = `playwright-chromium is not installed, and this needs a browser.
  Add it:      pnpm add -D playwright-chromium   (pnpm 10+ also asks to allow its install script: pnpm approve-builds)
  Then fetch:  pnpm exec playwright install chromium
  Or point SVG_DIAGRAM_CHROMIUM at a Chromium you already have (no package needed).
  (The layout, build and the default checks need no browser.)`;

const notFound = (e: unknown) => {
  const err = e as {code?: string; message?: string};
  return (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') && /playwright-chromium/.test(err.message ?? '');
};

/**
 * A headless Chromium. Through playwright-chromium when that is installed and has its browser; otherwise, when a Chromium can be found on the
 * machine (SVG_DIAGRAM_CHROMIUM, Python playwright's download in ~/.cache/ms-playwright, chromium on the PATH), through the DevTools protocol
 * directly (lib/cdp-browser.ts), so that a machine with only Node and a browser (ChatGPT's Code Interpreter) needs no npm package.
 * SVG_DIAGRAM_BROWSER=playwright or =cdp picks one outright.
 */
export async function launchChromium(options?: LaunchOptions): Promise<Browser> {
  const want = process.env['SVG_DIAGRAM_BROWSER'];
  if (want !== undefined && want !== '' && want !== 'auto' && want !== 'playwright' && want !== 'cdp') throw new Error(`SVG_DIAGRAM_BROWSER=${want}: expected 'playwright', 'cdp' or 'auto'`);
  const viaCdp = async () => (await launchCdp({...(options?.executablePath ? {executablePath: options.executablePath} : {}), ...(options?.args ? {args: options.args} : {})})) as unknown as Browser;
  if (want === 'cdp') return viaCdp();
  const canCdp = want !== 'playwright' && (!!options?.executablePath || findChromium() !== null);
  let chromium: typeof import('playwright-chromium').chromium;
  try { ({chromium} = await import('playwright-chromium')); }
  catch (e) { if (!notFound(e)) throw e; if (canCdp) return viaCdp(); throw new Error(BROWSER_HINT); }
  try { return await chromium.launch(options); }
  catch (e) {
    if (/Executable doesn't exist/.test((e as Error).message)) {
      if (canCdp && !options?.executablePath) return viaCdp();
      throw new Error(`playwright-chromium is installed but its browser was not downloaded.\n  Fetch it:  pnpm exec playwright install chromium\n\n${(e as Error).message}`);
    }
    throw e;
  }
}
