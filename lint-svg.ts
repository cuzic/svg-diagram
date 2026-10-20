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
//   node scripts/svg-diagram/lint-svg.ts --engine browser  # the checks on the rendering in a real Chromium (needs playwright-chromium)
//   node scripts/svg-diagram/lint-svg.ts --config .svg-diagram.json x.svg # the project settings to use (default: found from each SVG's own directory)
//   node scripts/svg-diagram/lint-svg.ts --fix              # mechanically fix font-size-too-small, then re-lint
//
// --fix currently covers only font-size-too-small (bump below-14px sizes up to
// 14px) — the one check that has been 100% mechanical, zero-judgment-call in
// practice every time it's fired. Other checks (off-token-color, text overlap,
// etc.) need a human to pick the right value/layout, so they stay report-only.
//
// Exit code is 0 iff zero ERROR-tier findings (or, with --strict, zero
// findings of any tier).
import type {Browser, Page} from 'playwright-chromium';
import {launchChromium} from './lib/browser.ts';
import {browserChecks} from './lib/lint-browser.ts';
import {geometryChecks, type RenderChecks} from './lib/geometry-checks.ts';
import {loadConfig, readConfigFile} from './lib/config.ts';
import type {Config} from './lib/types/project.ts';
import path from 'path';
import fs from 'fs';
import {ALLOWED_COLORS, DARK_COLORS, EMOJI_RE, MIN_FONT_SIZE, MIN_TEXT_ABSOLUTE} from './lib/tokens.ts';
import {stripAutoBlock, isAuto, autoSides, DARK_NOTE} from './lib/appearance-auto.ts';

import {must} from './lib/must.ts';
const strict = process.argv.includes('--strict');
const engineIdx = process.argv.indexOf('--engine');
const engine = engineIdx === -1 ? 'geometry' : process.argv[engineIdx + 1];
if (engine !== 'geometry' && engine !== 'browser') { console.error(`✗ --engine is geometry or browser (got ${engine ?? 'nothing'})`); process.exit(2); }
const fix = process.argv.includes('--fix');
const configIdx = process.argv.indexOf('--config');
const explicitConfig = configIdx === -1 ? undefined : process.argv[configIdx + 1];
if (configIdx !== -1 && !explicitConfig) { console.error('✗ --config needs a path to a .svg-diagram.json'); process.exit(2); }
const given = process.argv.slice(2).filter((a, i, all) => a.endsWith('.svg') && all[i - 1] !== '--engine' && all[i - 1] !== '--config');
// the project settings that apply to one SVG: --config, else the .svg-diagram.json found walking up from the SVG's own directory (not from the cwd)
const configCache = new Map<string, Config>();
function configFor(file: string): Config {
  const key = explicitConfig ? path.resolve(explicitConfig) : path.dirname(path.resolve(file));
  let cfg = configCache.get(key);
  if (!cfg) {
    try { cfg = explicitConfig ? readConfigFile(key) : loadConfig(key); }
    catch (e) { console.error(`✗ ${(e as Error).message}`); process.exit(2); }
    configCache.set(key, cfg);
  }
  return cfg;
}
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
const noticeFindings: {file: string; check: string; detail: string}[] = []; // told, never counted as a failure

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
    if (!/\by=/.test(must(m[1]))) {
      staticFindings.push({file: f, check: 'text-missing-y', detail: `<text ${must(m[1]).trim().slice(0, 60)}...> has no y= attribute — collapses to y=0`});
      break;
    }
  }
  if (/font-family="'[^,]+?'"/.test(src) || /font-family:\s*'[^,;]+?'\s*;/.test(src)) {
    staticFindings.push({file: f, check: 'font-family-no-fallback', detail: 'font-family has a single font with no fallback chain — use the full CJK stack'});
  }
  const styleBlock = /<style>([\s\S]*?)<\/style>/.exec(src);
  if (styleBlock) {
    for (const rule of must(styleBlock[1]).matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
      const name = must(rule[1]), body = must(rule[2]);
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
  // the text floor: 14px, or what the figure declared (data-min-text, a canvas figure that lowered it) when the project's fontFloor allows that
  let floor = MIN_FONT_SIZE;
  const declared = /<svg[^>]*\sdata-min-text="([^"]*)"/.exec(src)?.[1];
  if (declared !== undefined) {
    const n = Number(declared), allowed = configFor(f).fontFloor ?? MIN_FONT_SIZE;
    if (!declared.trim() || !Number.isFinite(n) || n < MIN_TEXT_ABSOLUTE) {
      staticFindings.push({file: f, check: 'font-floor-not-permitted', detail: `data-min-text="${declared}" is not a number of ${MIN_TEXT_ABSOLUTE} or more`});
    } else if (n < allowed) {
      staticFindings.push({file: f, check: 'font-floor-not-permitted', detail: `data-min-text="${n}" is below the project's fontFloor (${allowed}): set "fontFloor" in .svg-diagram.json (${MIN_TEXT_ABSOLUTE} at the lowest), or raise the diagram's canvas minText`});
    } else if (n < MIN_FONT_SIZE) {
      floor = n;
      noticeFindings.push({file: f, check: 'font-floor-lowered', detail: `minText ${n}px(案件の fontFloor ${allowed})。文字の下限を ${MIN_FONT_SIZE}px から下げた図(1:1 で読む前提。投影には向かない)`});
    }
  }
  const smallSizes = new Set<number>();
  for (const m of src.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) if (+m[1] < floor) smallSizes.add(+m[1]);
  for (const m of src.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) if (+m[1] < floor) smallSizes.add(+m[1]);
  if (smallSizes.size) {
    if (fix) {
      src = src
        .replace(/font-size="(\d+(?:\.\d+)?)"/g, (m0, n) => (+n < floor ? `font-size="${floor}"` : m0))
        .replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (m0, n) => (+n < floor ? `font-size: ${floor}px` : m0));
      fs.writeFileSync(f, src);
      fixedFiles.push({file: f, check: 'font-size-too-small', detail: `bumped ${[...smallSizes].sort((a, b) => a - b).join(', ')}px → ${floor}px`});
    } else {
      staticFindings.push({file: f, check: 'font-size-too-small', detail: `uses font-size below the ${floor}px floor: ${[...smallSizes].sort((a, b) => a - b).join(', ')}px`});
    }
  }

  const usedColors = new Set<string>();
  for (const m of stripAutoBlock(src).matchAll(/(?:fill|stroke)\s*[:=]\s*"?#([0-9a-fA-F]{6})/g)) usedColors.add('#' + m[1].toLowerCase());
  // a diagram that says it is dark (data-appearance) may also use the dark tokens and its own dark set (data-palette); a light one may not
  const dark = /<svg[^>]*\sdata-appearance="dark"/.test(src);
  // data-tone-colors: the colours diagram({tones}) / the config's tones put in (light or dark), allowed in either appearance
  const custom = new Set([...(dark ? (/<svg[^>]*\sdata-palette="([^"]*)"/.exec(src)?.[1] ?? '').split(' ') : []), ...(/<svg[^>]*\sdata-tone-colors="([^"]*)"/.exec(src)?.[1] ?? '').split(' ')]);
  const offToken = [...usedColors].filter(c => !ALLOWED_COLORS.has(c) && !(dark && DARK_COLORS.has(c)) && !custom.has(c));
  if (offToken.length) {
    advisoryFindings.push({file: f, check: 'off-token-color', detail: `uses color(s) outside the token set: ${offToken.join(', ')}`});
  }
  // appearance: 'auto' (ADR 0023 D4): the dark side is the figure with its @media block taken out and recoloured by the dark table. It has
  // its own allowed set (the dark tokens, the dark custom set, tone colours), kept apart from the light one so a light figure cannot pass
  // with a dark colour in it (nor the other way round). A colour already reported on the light side is not reported twice.
  if (isAuto(src)) {
    const darkColors = new Set<string>();
    for (const m of autoSides(src).dark.matchAll(/(?:fill|stroke)\s*[:=]\s*"?#([0-9a-fA-F]{6})/g)) darkColors.add('#' + m[1].toLowerCase());
    const darkCustom = new Set([...(/<svg[^>]*\sdata-palette="([^"]*)"/.exec(src)?.[1] ?? '').split(' '), ...(/<svg[^>]*\sdata-tone-colors="([^"]*)"/.exec(src)?.[1] ?? '').split(' ')]);
    const offDark = [...darkColors].filter(c => !DARK_COLORS.has(c) && !darkCustom.has(c) && !offToken.includes(c));
    if (offDark.length) advisoryFindings.push({file: f, check: 'off-token-color', detail: `uses color(s) outside the token set on the dark side (${DARK_NOTE}): ${offDark.join(', ')}`});
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
    const textAttrs = must(m[1]), textContent = must(m[2]);
    const textHasClass = /\bclass="emoji"/.test(textAttrs);
    let direct = textContent;
    for (const tm of textContent.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)) {
      const tspanFull = tm[0], tspanAttrs = must(tm[1]), tspanContent = must(tm[2]);
      direct = direct.replace(tspanFull, '');
      if (EMOJI_RE.test(tspanContent) && !textHasClass && !/\bclass="emoji"/.test(tspanAttrs)) {
        advisoryFindings.push({file: f, check: 'emoji-missing-class', detail: `<tspan> contains an emoji glyph without class="emoji" on itself or its parent <text>: "${tspanContent.trim().slice(0, 20)}"`});
      }
    }
    if (EMOJI_RE.test(direct) && !textHasClass) {
      advisoryFindings.push({file: f, check: 'emoji-missing-class', detail: `<text> contains an emoji glyph without class="emoji": "${direct.trim().slice(0, 20)}"`});
    }
  }

  // (box({icon}) draws a line / colour icon as one <g transform> around the set's own shapes: that group is the icon)
  // (math() draws a formula as outlines inside nested transformed groups: they are the formula's own, not shapes an author placed)
  const shapes = src.replace(/<g data-math=""[\s\S]*?<\/g><!--\/math-->/g, '');
  if (/<g(?![^>]*\bdata-icon=)[^>]*\btransform\s*=/.test(shapes)) {
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
  for (const [, attrs] of shapes.matchAll(/<(?:rect|circle|ellipse|line)\b([^>]*)>/g)) {
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

// ---- checks on the rendering: contrast (composited) + canvas overflow + text overlap + text out of its box + shapes over text ----
// Done on the SVG's geometry with the layout's font files (no browser) unless `--engine browser` asks for a real Chromium.
const contrastFindings: {file: string; elements: {txt: string; delta: number; fg: string; bg: string}[]}[] = [];
const overflowFindings = [];
const textOverlapFindings = [];
const containerOverflowFindings = [];
const coveredFindings = [];

let browser: Browser | null = null;
let page: Page | null = null;
if (engine === 'browser') {
  try { browser = await launchChromium({args: ['--no-sandbox']}); page = await browser.newPage(); }
  catch (e) { console.error(`✗ --engine browser: ${(e as Error).message}`); process.exit(2); }
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // appearance: 'auto' is checked twice, as two SVG strings (ADR 0023 D4): the light side, and the dark side (the @media block taken out,
  // then recoloured). Neither engine has to evaluate a media query, so the geometry engine (the default) sees both sides too.
  const sides: {label: string; svg: string}[] = isAuto(src) ? [{label: f, svg: autoSides(src).light}, {label: `${f} (${DARK_NOTE})`, svg: autoSides(src).dark}] : [{label: f, svg: src}];
  for (const side of sides) {
    let result: RenderChecks | null;
    try { result = page ? await browserChecks(page, side.svg) : geometryChecks(side.svg, configFor(f).fonts); }
    catch (e) {
      const msg = (e as Error).message;
      if (/^not well-formed XML/.test(msg)) { staticFindings.push({file: f, check: 'not-well-formed-xml', detail: `${msg} — an <img> would not load it, and the checks on the rendering cannot read it`}); break; }
      console.error(`✗ ${f}: the checks on the rendering could not run: ${msg}\n  (use \`--engine browser\` to draw it in a real browser instead)`);
      process.exit(2);
    }
    if (!result) continue;
    if (result.contrast.length) contrastFindings.push({file: side.label, elements: result.contrast});
    if (result.overflow) overflowFindings.push({file: side.label, ...result.overflow});
    if (result.textOverlap.length) textOverlapFindings.push({file: side.label, pairs: result.textOverlap});
    if (result.containerOverflow.length) containerOverflowFindings.push({file: side.label, items: result.containerOverflow});
    if (result.covered.length) coveredFindings.push({file: side.label, items: result.covered});
  }
}
await browser?.close();

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

if (noticeFindings.length) {
  console.log(`── お知らせ(失敗に数えない): ${noticeFindings.length} ──`);
  for (const it of noticeFindings) console.log(`  [${it.check}] ${it.file} — ${it.detail}`);
  console.log('');
}

if (totalError === 0) {
  console.log(`✓ 0 error(s)${totalAdvisory ? ` (${totalAdvisory} advisory finding(s), see above)` : ''}`);
} else {
  console.log(`✗ ${totalError} error(s)${totalAdvisory ? ` + ${totalAdvisory} advisory finding(s)` : ''} — see above`);
}
const failCount = strict ? total : totalError;
process.exit(failCount === 0 ? 0 : 1);
