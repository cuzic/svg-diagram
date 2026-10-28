export const BROWSER_HINT = `playwright-chromium is not installed, and this needs a browser.
  Add it:      pnpm add -D playwright-chromium   (pnpm 10+ also asks to allow its install script: pnpm approve-builds)
  Then fetch:  pnpm exec playwright install chromium
  (The layout, build and the default checks need no browser.)`;
const notFound = (e) => {
    const err = e;
    return (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') && /playwright-chromium/.test(err.message ?? '');
};
export async function launchChromium(options) {
    let chromium;
    try {
        ({ chromium } = await import('playwright-chromium'));
    }
    catch (e) {
        if (notFound(e))
            throw new Error(BROWSER_HINT);
        throw e;
    }
    try {
        return await chromium.launch(options);
    }
    catch (e) {
        if (/Executable doesn't exist/.test(e.message))
            throw new Error(`playwright-chromium is installed but its browser was not downloaded.\n  Fetch it:  pnpm exec playwright install chromium\n\n${e.message}`);
        throw e;
    }
}
