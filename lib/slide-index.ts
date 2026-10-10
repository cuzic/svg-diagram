#!/usr/bin/env node
// Computes the global 1-based Slidev slide index for a heading inside a
// pages/*.md file — WITHOUT a hardcoded "+2 for cover+toc" offset. Instead
// it walks slides.md's own `---`-delimited segments in order, following
// each `src: ./pages/<file>.md` reference exactly like Slidev itself does,
// and counts "^# " headings (one per rendered slide) along the way. This
// stays correct even if the cover/toc structure changes, a new pages/*.md
// file is inserted, or a session gains/loses slides — nothing here needs
// manual re-derivation the way the "+2" comment in token-economy.md,
// verify-slide-render's SKILL.md, and global-bottom.vue's session table do.
//
// Usage (CLI):
//   node scripts/svg-diagram/lib/slide-index.ts <page.md> "<heading substring>"
//   node scripts/svg-diagram/lib/slide-index.ts "day2-10:ArchUnitとは"   # single-arg form
//   node scripts/svg-diagram/lib/slide-index.ts --total                  # just print total slide count
//
// Usage (module):
//   import { computeSlideIndex, countTotalSlides } from './slide-index.ts'
//   const index = computeSlideIndex('slides.md', 'pages/day2-10.md', 'ArchUnitとは')

import fs from 'fs';
import path from 'path';

const HEADING_RE = /^# (.+)$/m;
const SRC_RE = /^src:\s*(\S+)/m;

function splitSegments(src) {
  return src.split(/\n---\n/);
}

function headingsInFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  return splitSegments(src)
    .map(seg => {
      const m = HEADING_RE.exec(seg);
      return m ? m[1].trim() : null;
    })
    .filter(Boolean);
}

// Returns [{ file: absPath|null, headings: string[] }, ...] in deck order.
// file is null for slides literally inline in slides.md (cover, toc).
export function resolveDeckOrder(slidesMdPath) {
  const abs = path.resolve(slidesMdPath);
  const src = fs.readFileSync(abs, 'utf8');
  const baseDir = path.dirname(abs);
  const order = [];
  for (const seg of splitSegments(src)) {
    const srcMatch = SRC_RE.exec(seg);
    if (srcMatch) {
      const target = path.resolve(baseDir, srcMatch[1].replace(/^\.\//, ''));
      order.push({ file: target, headings: headingsInFile(target) });
    } else {
      const h = HEADING_RE.exec(seg);
      if (h) order.push({ file: null, headings: [h[1].trim()] });
    }
  }
  return order;
}

export function countTotalSlides(slidesMdPath) {
  return resolveDeckOrder(slidesMdPath).reduce((n, e) => n + e.headings.length, 0);
}

// Throws with a descriptive message on no-match / ambiguous-match instead of
// returning a silently-wrong index.
export function computeSlideIndex(slidesMdPath, targetFile, headingSubstring) {
  const targetAbs = path.resolve(targetFile);
  const order = resolveDeckOrder(slidesMdPath);

  let cumulative = 0;
  for (const entry of order) {
    if (entry.file === targetAbs) {
      const matches = entry.headings
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => h.includes(headingSubstring));
      if (matches.length === 0) {
        const list = entry.headings.map((h, i) => `  [${i + 1}] ${h}`).join('\n');
        throw new Error(`no heading in ${targetFile} contains "${headingSubstring}". Headings in this file:\n${list}`);
      }
      if (matches.length > 1) {
        const list = matches.map(({ h, i }) => `  [${i + 1}] ${h}`).join('\n');
        throw new Error(`"${headingSubstring}" matches ${matches.length} headings in ${targetFile}, be more specific:\n${list}`);
      }
      return cumulative + matches[0].i + 1;
    }
    cumulative += entry.headings.length;
  }
  throw new Error(`${targetFile} is not imported (via src:) from ${slidesMdPath} — check the path (relative to ${path.dirname(path.resolve(slidesMdPath))}) and that it's actually referenced there`);
}

// ---- CLI ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const slidesMd = 'slides.md';

  if (args[0] === '--total') {
    console.log(countTotalSlides(slidesMd));
    process.exit(0);
  }

  let pageArg, heading;
  if (args.length === 1 && args[0].includes(':')) {
    [pageArg, heading] = args[0].split(/:(.+)/s);
  } else if (args.length === 2) {
    [pageArg, heading] = args;
  } else {
    console.error('Usage: node scripts/svg-diagram/lib/slide-index.ts <page.md> "<heading substring>"');
    console.error('       node scripts/svg-diagram/lib/slide-index.ts "day2-10:ArchUnitとは"');
    console.error('       node scripts/svg-diagram/lib/slide-index.ts --total');
    process.exit(2);
  }

  const pageFile = pageArg.includes('/') ? pageArg : path.join('pages', pageArg);
  try {
    console.log(computeSlideIndex(slidesMd, pageFile, heading));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
