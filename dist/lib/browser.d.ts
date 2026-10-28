import type { Browser, LaunchOptions } from 'playwright-chromium';
export declare const BROWSER_HINT = "playwright-chromium is not installed, and this needs a browser.\n  Add it:      pnpm add -D playwright-chromium   (pnpm 10+ also asks to allow its install script: pnpm approve-builds)\n  Then fetch:  pnpm exec playwright install chromium\n  (The layout, build and the default checks need no browser.)";
export declare function launchChromium(options?: LaunchOptions): Promise<Browser>;
