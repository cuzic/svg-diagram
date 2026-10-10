#!/usr/bin/env node
// svg-diagram contact a.svg b.svg ... --out sheet.png [--cols 2] [--width 1400]
// Several diagrams on one picture, to review a whole set at a glance (checks cannot judge balance or spacing).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-chromium';

const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const out = val('--out', 'contact-sheet.png'), cols = +val('--cols', 2), width = +val('--width', 1400);
const files = args.filter((a, i) => a.endsWith('.svg') && !['--out', '--cols', '--width'].includes(args[i - 1]));
if (!files.length) { console.error('Usage: svg-diagram contact a.svg b.svg ... --out sheet.png [--cols 2] [--width 1400]'); process.exit(2); }

const html = `<body style="margin:0;background:#fff;font:14px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:20px;padding:16px;align-items:start">${
  files.map(f => `<figure style="margin:0;border:1px solid #e0d6c5;padding:8px"><figcaption style="color:#6f6659;margin-bottom:6px">${path.basename(f)}</figcaption><img src="file://${path.resolve(f)}" style="width:100%;display:block"></figure>`).join('')
}</div></body>`;
const page_html = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'contact-')), 'sheet.html');
fs.writeFileSync(page_html, html);
const browser = await chromium.launch({args: ['--no-sandbox']});
const page = await browser.newPage({viewport: {width, height: 800}});
await page.goto(`file://${page_html}`, {waitUntil: 'load'});
await page.screenshot({path: out, fullPage: true});
await browser.close();
console.log(`wrote ${out} (${files.length} diagrams)`);
