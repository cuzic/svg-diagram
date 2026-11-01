import {register} from 'node:module';
register('./block-module.ts', import.meta.url);
// these tests mean "no browser": without this, a Chromium found on the machine would be driven directly (lib/cdp-browser.ts)
process.env['SVG_DIAGRAM_BROWSER'] ??= 'playwright';
