import type { Browser, LaunchOptions } from 'playwright-chromium';
export declare const BROWSER_HINT = "playwright-chromium is not installed, and this needs a browser.\n  Add it:      pnpm add -D playwright-chromium   (pnpm 10+ also asks to allow its install script: pnpm approve-builds)\n  Then fetch:  pnpm exec playwright install chromium\n  Or point SVG_DIAGRAM_CHROMIUM at a Chromium you already have (no package needed).\n  (The layout, build and the default checks need no browser.)";
/**
 * A headless Chromium. Through playwright-chromium when that is installed and has its browser; otherwise, when a Chromium can be found on the
 * machine (SVG_DIAGRAM_CHROMIUM, Python playwright's download in ~/.cache/ms-playwright, chromium on the PATH), through the DevTools protocol
 * directly (lib/cdp-browser.ts), so that a machine with only Node and a browser (ChatGPT's Code Interpreter) needs no npm package.
 * SVG_DIAGRAM_BROWSER=playwright or =cdp picks one outright.
 */
export declare function launchChromium(options?: LaunchOptions): Promise<Browser>;
