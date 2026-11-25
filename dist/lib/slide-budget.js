// Measures how tall an <img> can be on a given slide, instead of guessing.
//
// The budget depends on the slide's own body text, so it can only be known by
// laying the slide out: this renders it in a throwaway Slidev dev server,
// hides the target <img>, finds where the remaining in-flow content ends, and
// returns what is left above the bottom limit (the same ~6% bottom band
// check-slide-overflow.ts flags). Also returns the image's real available
// width, so fit.ts doesn't have to assume one.
//
// Results are cached in .cache/slide-budget.json, keyed by page+heading and
// validated by a hash of (the slide's markdown with the img's max-height
// stripped) + (the theme files that affect layout). Changing only the img's
// max-height — which is what the budget feeds — does not invalidate the cache;
// editing the slide's text, style.css, uno.config.ts, global-bottom.vue or
// slides.md does. A cache hit costs no browser and no dev server.
//
// Usage (module): getSlideBudget({page, heading, svg}) ->
//   {maxHeight, contentWidth, index, cached}
// CLI: node scripts/svg-diagram/lib/slide-budget.ts <page.md> "<heading>" <svg-file> [--refresh]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { computeSlideIndex } from './slide-index.js';
import { must } from './must.js';
const CACHE_FILE = '.cache/slide-budget.json';
const LAYOUT_FILES = ['slides.md', 'style.css', 'uno.config.ts', 'global-bottom.vue'];
function slideMarkdown(pageFile, heading) {
    const segs = fs.readFileSync(pageFile, 'utf8').split(/\n---\n/);
    const i = segs.findIndex(s => /^# (.+)$/m.test(s) && must(must(s.match(/^# (.+)$/m))[1]).includes(heading));
    if (i < 0)
        throw new Error(`heading "${heading}" not found in ${pageFile}`);
    const prev = i > 0 && !/^# /m.test(must(segs[i - 1])) ? must(segs[i - 1]) : ''; // frontmatter segment
    return prev + '\n---\n' + segs[i];
}
export function cacheKey(pageFile, heading, svg) {
    const md = slideMarkdown(pageFile, heading).replace(/max-height:\s*\d+px;?\s*/g, '');
    const h = crypto.createHash('sha256').update(md).update('\0' + svg);
    for (const f of LAYOUT_FILES)
        if (fs.existsSync(f))
            h.update('\0' + fs.readFileSync(f));
    return h.digest('hex').slice(0, 16);
}
function readCache() {
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
    catch {
        return {};
    }
}
// The cached budget for this slide, or null when there is none (or it is stale). Starts no dev server and writes nothing —
// for callers (`svg-diagram show`) that must not have side effects.
export function readSlideBudgetCache({ page, heading, svg, slidesMd = 'slides.md' }) {
    try {
        const index = computeSlideIndex(slidesMd, page, heading);
        const hit = readCache()[`${path.relative('.', page)}#${heading}#${svg}`];
        return hit && hit.hash === cacheKey(page, heading, svg) ? { ...hit.result, index, cached: true } : null;
    }
    catch {
        return null;
    }
}
export async function getSlideBudget({ page, heading, svg, slidesMd = 'slides.md', refresh = false }) {
    const index = computeSlideIndex(slidesMd, page, heading);
    const key = `${path.relative('.', page)}#${heading}#${svg}`;
    const hash = cacheKey(page, heading, svg);
    const cache = readCache();
    const hit = cache[key];
    if (!refresh && hit && hit.hash === hash)
        return { ...hit.result, index, cached: true };
    const { measureSlideBudget } = await import('./slide-budget-live.js');
    const result = await measureSlideBudget(index, svg);
    cache[key] = { hash, result, measuredAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
    return { ...result, index, cached: false };
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    const [page, heading, svg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
    if (!page || !heading || !svg) {
        console.error('Usage: slide-budget.ts <page.md> "<heading>" <svg-file> [--refresh]');
        process.exit(2);
    }
    console.log(JSON.stringify(await getSlideBudget({ page, heading, svg, refresh: process.argv.includes('--refresh') })));
}
