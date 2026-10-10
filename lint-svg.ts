#!/usr/bin/env node
// SVG diagram linter for public/svg/*.svg (this Slidev deck).
//
// Adapted from ~/ai-employees/scripts/lint-svg.ts (AI社員シリーズ book
// pipeline's svg-diagram skill). Same check logic; the file-glob and color
// token table are localized to this project. See
// ~/ai-employees/.claude/skills/svg-diagram/SKILL.md "既知の落とし穴" for
// the narrative version of every check below — each corresponds to a real
// defect that was invisible to `git diff` review and only showed up once
// actually rendered.
//
// Usage:
//   node scripts/svg-diagram/lint-svg.ts                  # scan public/svg/*.svg
//   node scripts/svg-diagram/lint-svg.ts public/svg/x.svg # one file
//   node scripts/svg-diagram/lint-svg.ts --strict          # advisories also fail
//   node scripts/svg-diagram/lint-svg.ts --fix              # mechanically fix font-size-too-small, then re-lint
//
// --fix currently covers only font-size-too-small (bump below-14px sizes up to
// 14px) — the one check that has been 100% mechanical, zero-judgment-call in
// practice every time it's fired. Other checks (off-token-color, text overlap,
// etc.) need a human to pick the right value/layout, so they stay report-only.
//
// Exit code is 0 iff zero ERROR-tier findings (or, with --strict, zero
// findings of any tier).
import {chromium} from 'playwright-chromium';
import fs from 'fs';
import {ALLOWED_COLORS, EMOJI_RE} from './lib/tokens.ts';

const strict = process.argv.includes('--strict');
const fix = process.argv.includes('--fix');
const given = process.argv.slice(2).filter(a => a.endsWith('.svg'));
let files;
if (given.length) {
  files = given; // every .svg named on the command line (it used to look at the first one only)
} else {
  files = fs.globSync('svg/*.svg').sort();
}
if (files.length === 0) {
  console.error('no SVG files matched');
  process.exit(2);
}

// day1(legacy/amber) と day2(modern/teal) の2アクセント体制。
// ALLOWED_COLORS は lib/tokens.ts が唯一の正 — style.css / uno.config.ts の
// トークンと一致させること。dsl.ts(図版ビルダー)も同じ定数を参照する。

// ---- static (non-render) checks: source-text pattern matching ----------
const staticFindings = [];
const advisoryFindings = [];
const fixedFiles = [];

for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');

  if (/\brx="[\d.]+\s+[\d.]+/.test(src)) {
    staticFindings.push({file: f, check: 'invalid-rx', detail: 'rx="a b c d" is invalid on <rect> — use a <path> for asymmetric rounding'});
  }
  if (/writing-mode\s*=\s*"tb"/.test(src)) {
    staticFindings.push({file: f, check: 'writing-mode-tb', detail: 'writing-mode="tb" garbles CJK glyph spacing — use transform="rotate(-90 x y)" on a horizontal <text> instead'});
  }
  if (/<br\s*\/?>/.test(src)) {
    staticFindings.push({file: f, check: 'br-in-text', detail: '<br/> is not valid SVG — use <tspan x="..." dy="1.2em"> for line breaks'});
  }
  if (/<span\b/.test(src)) {
    staticFindings.push({file: f, check: 'span-in-text', detail: '<span> inside <text> can break parsing and drop everything after it in the document — use <tspan> instead'});
  }
  for (const m of src.matchAll(/<text\b([^>]*)>/g)) {
    if (!/\by=/.test(m[1])) {
      staticFindings.push({file: f, check: 'text-missing-y', detail: `<text ${m[1].trim().slice(0, 60)}...> has no y= attribute — collapses to y=0`});
      break;
    }
  }
  if (/font-family="'[^,]+?'"/.test(src) || /font-family:\s*'[^,;]+?'\s*;/.test(src)) {
    staticFindings.push({file: f, check: 'font-family-no-fallback', detail: 'font-family has a single font with no fallback chain — use the full CJK stack'});
  }
  const styleBlock = /<style>([\s\S]*?)<\/style>/.exec(src);
  if (styleBlock) {
    for (const rule of styleBlock[1].matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
      const [, name, body] = rule;
      if (/(?<!-)color\s*:/.test(body) && !/(?<!-)fill\s*:/.test(body)) {
        staticFindings.push({file: f, check: 'css-color-not-fill', detail: `.${name} sets color: instead of fill: — has no effect on SVG text`});
      }
    }
  }
  for (const ref of new Set([...src.matchAll(/marker-(?:end|start)="url\(#([^)]+)\)"/g)].map(m => m[1]))) {
    if (!new RegExp(`marker\\s+id="${ref}"`).test(src)) {
      staticFindings.push({file: f, check: 'undefined-marker', detail: `marker-end/start references #${ref} but no <marker id="${ref}"> is defined in this file`});
    }
  }
  const smallSizes = new Set<number>();
  for (const m of src.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) if (+m[1] < 14) smallSizes.add(+m[1]);
  for (const m of src.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) if (+m[1] < 14) smallSizes.add(+m[1]);
  if (smallSizes.size) {
    if (fix) {
      src = src
        .replace(/font-size="(\d+(?:\.\d+)?)"/g, (m0, n) => (+n < 14 ? 'font-size="14"' : m0))
        .replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (m0, n) => (+n < 14 ? 'font-size: 14px' : m0));
      fs.writeFileSync(f, src);
      fixedFiles.push({file: f, check: 'font-size-too-small', detail: `bumped ${[...smallSizes].sort((a, b) => a - b).join(', ')}px → 14px`});
    } else {
      staticFindings.push({file: f, check: 'font-size-too-small', detail: `uses font-size below the 14px floor: ${[...smallSizes].sort((a, b) => a - b).join(', ')}px`});
    }
  }

  const usedColors = new Set<string>();
  for (const m of src.matchAll(/(?:fill|stroke)\s*[:=]\s*"?#([0-9a-fA-F]{6})/g)) usedColors.add('#' + m[1].toLowerCase());
  const offToken = [...usedColors].filter(c => !ALLOWED_COLORS.has(c));
  if (offToken.length) {
    advisoryFindings.push({file: f, check: 'off-token-color', detail: `uses color(s) outside the token set: ${offToken.join(', ')}`});
  }

  // emoji glyphs need class="emoji" (Noto Color Emoji / Segoe UI Emoji fallback) — the CJK
  // stack used elsewhere has no emoji glyphs and silently drops them on some renderers.
  // Scoped to the color-pictograph blocks only (1F300-1FAFF, plus the handful of colorized
  // symbols outside it like ⭐ star / ⚠ warning) — deliberately excludes 2600-27BF
  // dingbats such as ✓/✗ (check/cross), which render fine in ordinary text fonts
  // and are already used unclassed elsewhere in this deck.
  // See docs/diagram-tone-and-manner.md section 3.5.
  // tspan-aware: a <tspan> inherits its parent <text>'s font via CSS cascade,
  // so class="emoji" on EITHER the <text> or the specific <tspan> is enough.
  // Checking only the outer <text> attrs (as an earlier version of this check
  // did) both false-positives when a <tspan class="emoji"> is nested inside an
  // unclassed <text>, and misses the opposite case — a bare emoji sitting
  // directly in <text> content alongside a classed <tspan> sibling.
  for (const m of src.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const [, textAttrs, textContent] = m;
    const textHasClass = /\bclass="emoji"/.test(textAttrs);
    let direct = textContent;
    for (const tm of textContent.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)) {
      const [tspanFull, tspanAttrs, tspanContent] = tm;
      direct = direct.replace(tspanFull, '');
      if (EMOJI_RE.test(tspanContent) && !textHasClass && !/\bclass="emoji"/.test(tspanAttrs)) {
        advisoryFindings.push({file: f, check: 'emoji-missing-class', detail: `<tspan> contains an emoji glyph without class="emoji" on itself or its parent <text>: "${tspanContent.trim().slice(0, 20)}"`});
      }
    }
    if (EMOJI_RE.test(direct) && !textHasClass) {
      advisoryFindings.push({file: f, check: 'emoji-missing-class', detail: `<text> contains an emoji glyph without class="emoji": "${direct.trim().slice(0, 20)}"`});
    }
  }

  if (/<g[^>]*\btransform\s*=/.test(src)) {
    advisoryFindings.push({file: f, check: 'group-transform', detail: '<g transform="..."> wrapping children — bake the offset into each child\'s own coordinates instead'});
  }

  // Scoped to structural shape tags only (rect/circle/ellipse/line) — these are
  // the boxes/dividers an author positions deliberately, so drift off-grid is a
  // real authoring slip. <text>/<tspan> x/y are excluded: they're anchor points
  // for text-anchor="middle"-centered labels, which are legitimately computed
  // (box-center, midpoints, etc.) and land off-grid by design as often as not —
  // including them just made this check fire on nearly every file regardless of
  // real layout care (see docs/diagram-tone-and-manner.md review notes, 2026-08).
  const coords = [];
  for (const [, attrs] of src.matchAll(/<(?:rect|circle|ellipse|line)\b([^>]*)>/g)) {
    for (const m of attrs.matchAll(/\b(?:x|y|x1|y1|x2|y2|cx|cy|width|height)="(-?[\d.]+)"/g)) {
      coords.push(+m[1]);
    }
  }
  if (coords.length >= 8) {
    const onGrid = coords.filter(n => Number.isInteger(n) && n % 4 === 0).length;
    const rate = onGrid / coords.length;
    if (rate < 0.7) {
      advisoryFindings.push({file: f, check: 'coordinate-grid', detail: `only ${(rate * 100).toFixed(0)}% of ${coords.length} shape coordinates are on a 4px grid`});
    }
  }
}

// ---- render-based checks: contrast (composited) + canvas overflow -------
const browser = await chromium.launch({args: ['--no-sandbox']});
const page = await browser.newPage();
const contrastFindings: {file: string; elements: {txt: string; delta: number; fg: string; bg: string}[]}[] = [];
const overflowFindings = [];
const textOverlapFindings = [];
const containerOverflowFindings = [];
const coveredFindings = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  await page.setContent(`<body style="margin:0">${src}</body>`);

  const result = await page.evaluate(() => {
    const svg = document.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return null;
    const vb = svg.viewBox.baseVal;
    const W = vb.width || +svg.getAttribute('width')!;
    const H = vb.height || +svg.getAttribute('height')!;

    type RGBA = {r: number; g: number; b: number; a: number};
    const parseColor = (c: string): RGBA | null => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c);
      return m ? {r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4]} : null;
    };
    const luminance = (c: RGBA) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const compositeOver = (fg: RGBA, bg: RGBA): RGBA => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });

    const shapes = ([...svg.querySelectorAll('rect,circle,ellipse,polygon,path')] as SVGGraphicsElement[]).map(e => {
      let bb: DOMRect;
      try { bb = e.getBBox(); } catch { return null; }
      const cs = getComputedStyle(e);
      const c = parseColor(cs.fill);
      if (!c || cs.fill === 'none') return null;
      const a = c.a * parseFloat(cs.fillOpacity || '1') * parseFloat(cs.opacity || '1');
      return {bb, c: {...c, a}};
    }).filter((x): x is {bb: DOMRect; c: RGBA} => x !== null);

    const contrast: {txt: string; delta: number; fg: string; bg: string}[] = [];
    for (const t of svg.querySelectorAll('text')) {
      let bb: DOMRect;
      try { bb = t.getBBox(); } catch { continue; }
      if (!bb.width) continue;
      const txt = (t.textContent || '').trim();
      if (!txt) continue;
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      let bg = {r: 255, g: 255, b: 255, a: 1};
      for (const s of shapes) {
        const q = s.bb;
        if (cx >= q.x && cx <= q.x + q.width && cy >= q.y && cy <= q.y + q.height) bg = compositeOver(s.c, bg);
      }
      const tc = parseColor(getComputedStyle(t).fill);
      if (!tc) continue;
      const d = Math.abs(luminance(tc) - luminance(bg));
      if (d < 70) {
        contrast.push({txt: txt.slice(0, 40), delta: +d.toFixed(0), fg: getComputedStyle(t).fill, bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})`});
      }
    }

    let bbAll: DOMRect | null;
    try { bbAll = svg.getBBox(); } catch { bbAll = null; }
    const overflow = bbAll && (bbAll.y + bbAll.height > H + 2 || bbAll.x + bbAll.width > W + 2)
      ? {dx: +(bbAll.x + bbAll.width - W).toFixed(0), dy: +(bbAll.y + bbAll.height - H).toFixed(0)}
      : null;

    const texts = [...svg.querySelectorAll('text')].map(t => {
      const bb = t.getBoundingClientRect();
      const txt = (t.textContent || '').trim();
      if (!txt || !bb.width || !bb.height) return null;
      return {txt: txt.slice(0, 30), bb};
    }).filter((x): x is {txt: string; bb: DOMRect} => x !== null);

    const textOverlap: {a: string; b: string; ratio: number}[] = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].bb, b = texts[j].bb;
        const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ix <= 0 || iy <= 0) continue;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        const ratio = (ix * iy) / minArea;
        if (ratio > 0.3) {
          textOverlap.push({a: texts[i].txt, b: texts[j].txt, ratio: +ratio.toFixed(2)});
        }
      }
    }

    const rects = [...svg.querySelectorAll('rect')].map(r => {
      const cs = getComputedStyle(r);
      if (cs.fill === 'none' && cs.stroke === 'none') return null;
      const bb = r.getBoundingClientRect();
      if (!bb.width || !bb.height) return null;
      return bb;
    }).filter((x): x is DOMRect => x !== null);

    const containerOverflow: {txt: string; over: number}[] = [];
    const PAD = 4;
    for (const t of texts) {
      const bb = t.bb;
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      let best: DOMRect | null = null;
      for (const r of rects) {
        if (cx < r.x || cx > r.x + r.width || cy < r.y || cy > r.y + r.height) continue;
        const area = r.width * r.height;
        if (area < bb.width * bb.height) continue;
        if (!best || area < best.width * best.height) best = r;
      }
      if (!best) continue;
      const over = Math.max(
        best.x + PAD - bb.x,
        (bb.x + bb.width) - (best.x + best.width - PAD),
        best.y + PAD - bb.y,
        (bb.y + bb.height) - (best.y + best.height - PAD),
      );
      if (over > 3) containerOverflow.push({txt: t.txt, over: +over.toFixed(1)});
    }

    // A shape painted AFTER a text (so on top of it) must not cover the text, and a line must not run through it.
    // (A background drawn before the text is fine, and so is a shape marked data-allow-cover on itself or an ancestor.)
    const covered: {txt: string; by: string; how: 'covers' | 'crosses'}[] = [];
    {
      const items = ([...svg.querySelectorAll('rect,circle,ellipse,path,line,polygon,polyline,text')] as SVGGeometryElement[]).filter(e => !e.closest('defs,marker'));
      const info = items.map(e => {
        const cs = getComputedStyle(e);
        return {e, tag: e.tagName.toLowerCase(), bb: e.getBoundingClientRect(),
          fill: cs.fill !== 'none', stroke: cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0,
          op: parseFloat(cs.opacity) * parseFloat(cs.fillOpacity || '1')};
      });
      info.forEach((t, i) => {
        if (t.tag !== 'text' || !t.bb.width || !t.e.textContent!.trim()) return;
        for (let j = i + 1; j < info.length; j++) {
          const sh = info[j];
          if (sh.tag === 'text' || !sh.bb.width && !sh.bb.height || sh.e.closest('[data-allow-cover]')) continue;
          const ow = Math.min(t.bb.right, sh.bb.right) - Math.max(t.bb.left, sh.bb.left);
          const oh = Math.min(t.bb.bottom, sh.bb.bottom) - Math.max(t.bb.top, sh.bb.top);
          if (ow < 0 || oh < 0) continue; // (a vertical or horizontal line has a zero-width box: it can still run through the text)
          if (sh.fill && sh.op >= 0.5 && ow >= 3 && oh >= 3 && ow * oh >= 30) { covered.push({txt: t.e.textContent.trim(), by: sh.tag, how: 'covers'}); break; }
          if (sh.stroke && !sh.fill && sh.tag !== 'rect' && sh.e.getTotalLength) { // a stroke-only line/path: does it run through the text box?
            const len = sh.e.getTotalLength(), m = sh.e.getScreenCTM()!;
            let hit = false;
            for (let l = 0; l <= len && !hit; l += 3) {
              const pt = sh.e.getPointAtLength(l);
              const x = pt.x * m.a + pt.y * m.c + m.e, y = pt.x * m.b + pt.y * m.d + m.f;
              hit = x >= t.bb.left && x <= t.bb.right && y >= t.bb.top + 2 && y <= t.bb.bottom - 2;
            }
            if (hit) { covered.push({txt: t.e.textContent.trim(), by: sh.tag, how: 'crosses'}); break; }
          }
        }
      });
    }

    return {contrast, overflow, textOverlap, containerOverflow, covered};
  });

  if (!result) continue;
  if (result.contrast.length) contrastFindings.push({file: f, elements: result.contrast});
  if (result.overflow) overflowFindings.push({file: f, ...result.overflow});
  if (result.textOverlap.length) textOverlapFindings.push({file: f, pairs: result.textOverlap});
  if (result.containerOverflow.length) containerOverflowFindings.push({file: f, items: result.containerOverflow});
  if (result.covered.length) coveredFindings.push({file: f, items: result.covered});
}
await browser.close();

// ---- report ---------------------------------------------------------------
const totalStatic = staticFindings.length;
const totalContrastEls = contrastFindings.reduce((s, o) => s + o.elements.length, 0);
const totalOverflow = overflowFindings.length;
const totalTextOverlap = textOverlapFindings.reduce((s, o) => s + o.pairs.length, 0);
const totalContainerOverflow = containerOverflowFindings.reduce((s, o) => s + o.items.length, 0);
const totalCovered = coveredFindings.reduce((s, o) => s + o.items.length, 0);
const totalError = totalStatic + totalContrastEls + totalOverflow + totalTextOverlap;
const totalAdvisory = advisoryFindings.length + totalContainerOverflow + totalCovered;
const total = totalError + totalAdvisory;

console.log(`\nScanned ${files.length} file(s).\n`);

if (fixedFiles.length) {
  console.log(`── Fixed (--fix): ${fixedFiles.length} ──`);
  for (const it of fixedFiles) console.log(`  ${it.file} — ${it.check}: ${it.detail}`);
  console.log('');
}

if (staticFindings.length) {
  console.log(`── Static pattern findings: ${staticFindings.length} ──`);
  const byCheck: Record<string, typeof staticFindings> = {};
  for (const x of staticFindings) (byCheck[x.check] ??= []).push(x);
  for (const [check, items] of Object.entries(byCheck)) {
    console.log(`  [${check}] ${items.length}`);
    for (const it of items) console.log(`    ${it.file} — ${it.detail}`);
  }
  console.log('');
}

if (contrastFindings.length) {
  console.log(`── Low-contrast text (composited, delta<70): ${totalContrastEls} element(s) in ${contrastFindings.length} file(s) ──`);
  for (const o of contrastFindings) {
    console.log(`  ${o.file}`);
    for (const e of o.elements) console.log(`    "${e.txt}" fg=${e.fg} bg=${e.bg} delta=${e.delta}`);
  }
  console.log('');
}

if (overflowFindings.length) {
  console.log(`── Content overflowing declared canvas: ${totalOverflow} file(s) ──`);
  for (const o of overflowFindings) console.log(`  ${o.file} dx=${o.dx} dy=${o.dy}`);
  console.log('');
}

if (textOverlapFindings.length) {
  console.log(`── Text overlapping text (bbox intersection > 30%): ${totalTextOverlap} pair(s) in ${textOverlapFindings.length} file(s) ──`);
  for (const o of textOverlapFindings) {
    console.log(`  ${o.file}`);
    for (const p of o.pairs) console.log(`    "${p.a}" × "${p.b}" overlap=${(p.ratio * 100).toFixed(0)}%`);
  }
  console.log('');
}

if (containerOverflowFindings.length) {
  console.log(`── Text spilling out of its enclosing box (advisory, heuristic — verify before fixing): ${totalContainerOverflow} element(s) in ${containerOverflowFindings.length} file(s) ──`);
  for (const o of containerOverflowFindings) {
    console.log(`  ${o.file}`);
    for (const it of o.items) console.log(`    "${it.txt}" overflows container by ${it.over}px`);
  }
  console.log('');
}

if (coveredFindings.length) {
  console.log(`── A shape painted over a text, or a line through it (advisory; mark an intended overlap with data-allow-cover): ${totalCovered} element(s) in ${coveredFindings.length} file(s) ──`);
  for (const o of coveredFindings) {
    console.log(`  ${o.file}`);
    for (const it of o.items) console.log(`    "${it.txt}" is ${it.how === 'covers' ? 'covered by' : 'crossed by'} a ${it.by}`);
  }
  console.log('');
}

if (advisoryFindings.length) {
  console.log(`── Advisory (style-consistency, does not fail without --strict): ${totalAdvisory} ──`);
  const byCheck: Record<string, typeof advisoryFindings> = {};
  for (const x of advisoryFindings) (byCheck[x.check] ??= []).push(x);
  for (const [check, items] of Object.entries(byCheck)) {
    console.log(`  [${check}] ${items.length}`);
    for (const it of items) console.log(`    ${it.file} — ${it.detail}`);
  }
  console.log('');
}

if (totalError === 0) {
  console.log(`✓ 0 error(s)${totalAdvisory ? ` (${totalAdvisory} advisory finding(s), see above)` : ''}`);
} else {
  console.log(`✗ ${totalError} error(s)${totalAdvisory ? ` + ${totalAdvisory} advisory finding(s)` : ''} — see above`);
}
const failCount = strict ? total : totalError;
process.exit(failCount === 0 ? 0 : 1);
