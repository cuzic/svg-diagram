#!/usr/bin/env node
// svg-diagram site <deck.json...|site.json> --out DIR
// Several decks as a static site (ADR 0067): an index, and for each deck the viewer of `serve` (without a presenter), a print page and the
// slides as outlined SVGs with hashed names. Plain files only: deploying them (wrangler, CI, any static host) is not this command's job.
// Nothing is written unless every slide of every deck is drawn; DIR is replaced only when `site` wrote it and nobody added to it since.
import {createHash, randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installResolveHook, recordResolved} from './lib/resolve-hook.ts';
import {recordImageReads} from './lib/image-file.ts';
import {loadConfig} from './lib/config.ts';
import {outlineFontCheck} from './lib/font-metrics.ts';
import {closeMeasurer, configureMeasure, currentMeasure} from './lib/measure.ts';
import {loadDeck} from './lib/deck-load.ts';
import {renderDeck, type RenderedSlide} from './lib/present/render-deck.ts';
import {PAGE_CSP_META, PRESENT_CSS, PRESENT_JS, printPage, SITE_CSS, siteIndexPage, viewerPage, type PageConfig} from './lib/present/ui.ts';
import {assignSlugs, extraClash, headersFile, isInside, manifestJson, onlyOsFiles, parseSite, slidesJson, strangers, writtenBefore, type ManifestDeck, type SiteDeck, type SitePlan} from './lib/site.ts';

installResolveHook();
const USAGE = 'Usage: svg-diagram site <deck.json>... --out DIR\n       svg-diagram site <site.json> --out DIR';
const args = process.argv.slice(2);
const usage = (message?: string): never => { console.error(message ? `✗ ${message}\n${USAGE}` : USAGE); process.exit(2); };
for (const [i, arg] of args.entries()) {
  if (arg === '--help' || arg === '-h') { console.log(USAGE); process.exit(0); }
  if (arg.startsWith('--') && arg !== '--out') usage(`unknown option ${arg}`);
  if (arg === '--out' && (args[i + 1] === undefined || args[i + 1]?.startsWith('--'))) usage('--out needs a folder');
}
const outAt = args.indexOf('--out');
if (outAt < 0) usage('--out DIR is needed: the folder the site is written to');
const out = path.resolve(args[outAt + 1] as string);
const inputs = args.filter((_a, i) => i !== outAt && i !== outAt + 1);
if (!inputs.length) usage('name the decks (deck.json files), or one site.json');
const failNow = (lines: readonly string[]): never => { for (const l of lines) console.error(l.startsWith('✗') ? l : `✗ ${l}`); process.exit(1); };
const fail = failNow;

// --- what to draw: deck files, or one site.json (D1, D5) ---------------------------------------------------------------------------
const readJson = (f: string): unknown => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fail([`${f}: ${e instanceof Error ? e.message : String(e)}`]); }
};
const isSite = (v: unknown): boolean => typeof v === 'object' && v !== null && Array.isArray((v as {decks?: unknown}).decks);
for (const f of inputs) if (!f.endsWith('.json')) usage(`${f}: site takes deck .json files or one site.json`);
for (const f of inputs) if (!fs.existsSync(f)) usage(`${f} does not exist`);
const read = inputs.map(f => ({file: path.resolve(f), json: readJson(f)}));
const sites = read.filter(r => isSite(r.json));
let plan: SitePlan, siteFile: string | null = null;
if (sites.length) {
  if (read.length > 1) usage('a site.json goes alone: name the decks in it');
  siteFile = (sites[0] as {file: string}).file;
  const got = parseSite((sites[0] as {json: unknown}).json, siteFile);
  if (!got.ok) fail(got.errors);
  plan = (got as {ok: true; plan: SitePlan}).plan;
} else {
  plan = {decks: read.map((r, i) => ({deck: r.file, place: `argument ${i + 1} (${path.relative(process.cwd(), r.file) || r.file})`})), extra: []};
}

const {slugs, errors: slugErrors, warnings: slugWarnings} = assignSlugs(plan.decks);
const planErrors = [...slugErrors];
for (const x of plan.extra) {
  const clash = extraClash(x.to, slugs);
  if (clash) planErrors.push(`${path.basename(siteFile ?? 'site.json')}.extra["${x.to}"]: ${clash}`);
  let st: fs.Stats | null = null;
  try { st = fs.lstatSync(x.from); } catch { /* below */ }
  if (!st) planErrors.push(`${path.basename(siteFile ?? 'site.json')}.extra["${x.to}"]: ${x.from} does not exist`);
  else if (!st.isFile()) planErrors.push(`${path.basename(siteFile ?? 'site.json')}.extra["${x.to}"]: ${x.from} is not a plain file (a folder or a link)`);
}
for (const d of plan.decks) if (!fs.existsSync(d.deck)) planErrors.push(`${d.place}: ${d.deck} does not exist`);
if (planErrors.length) fail(planErrors);
for (const w of slugWarnings) console.error(`⚠ ${w}`);

// --- DIR: refused before anything is drawn, when replacing it would lose something (D10) ----------------------------------------
const tmpPrefix = `${path.basename(out)}.tmp-`, oldPrefix = `${path.basename(out)}.old-`, parent = path.dirname(out);
function listAll(dir: string, rel = ''): string[] {
  const got: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), {withFileTypes: true})) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { got.push(`${r}/`); got.push(...listAll(dir, r)); } else got.push(r);
  }
  return got;
}
function checkOut(again = false, cleanUp?: () => void): void {
  const fail = (lines: readonly string[]): never => { cleanUp?.(); return failNow(lines); };
  if (path.parse(out).root === out) fail([`--out ${out}: not the root of a drive`]);
  let st: fs.Stats | null = null;
  try { st = fs.lstatSync(out); } catch { /* not there yet */ }
  if (st?.isSymbolicLink()) fail([`--out ${out} is a symbolic link: replacing it would put a folder where the link is. Give the folder it points to (${fs.realpathSync(out)})`]);
  if (st && !st.isDirectory()) fail([`--out ${out} is a file, not a folder`]);
  if (st) {
    const entries = listAll(out);
    if (entries.length && !onlyOsFiles(entries)) {
      let manifest: string | null = null;
      try { manifest = fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'); } catch { /* none */ }
      const before = writtenBefore(manifest);
      if (!before) fail([`--out ${out} is not empty and was not written by svg-diagram site (no manifest.json of it): give an empty or new folder`]);
      const added = strangers(entries, (before as {files: string[]}).files);
      if (added.length) fail([`--out ${out} has files svg-diagram site did not write, which replacing it would delete: ${added.slice(0, 10).join(', ')}${added.length > 10 ? ` and ${added.length - 10} more` : ''}`,
        '  move them out, or have each one copied in at every run with a site.json "extra": {"CNAME": "site-files/CNAME"}']);
    }
  }
  if (again) return;
  // what an earlier run left when it stopped half-way
  let left: string[] = [];
  try { left = fs.readdirSync(parent).filter(n => n.startsWith(tmpPrefix) || n.startsWith(oldPrefix)); } catch { /* the parent is made below */ }
  for (const n of left) console.error(n.startsWith(oldPrefix)
    ? `⚠ ${path.join(parent, n)} is the site before an earlier run that stopped half-way${st ? '' : `: to get it back, rename it to ${out}`}; delete it when it is not needed`
    : `⚠ ${path.join(parent, n)} is what an earlier run left half-written: delete it`);
}
checkOut();

// --- drawing, one deck after another (D11: a project's settings are the whole process's) --------------------------------------------
const reads = new Set<string>();
recordResolved(url => { if (url.startsWith('file:')) reads.add(fileURLToPath(url)); });
recordImageReads(f => reads.add(path.resolve(f)));
interface Drawn {deck: SiteDeck; slug: string; title: string; slides: RenderedSlide[]}
const drawn: Drawn[] = [], errors: string[] = [];
let chromium = false;
for (const [i, d] of plan.decks.entries()) {
  const dir = path.dirname(d.deck), slug = slugs[i] as string, rel = path.relative(process.cwd(), d.deck), shown = rel && !rel.startsWith('..') ? rel : d.deck;
  reads.add(d.deck);
  for (let p = dir; ; p = path.dirname(p)) { const c = path.join(p, '.svg-diagram.json'); if (fs.existsSync(c)) reads.add(c); if (path.dirname(p) === p) break; }
  let cfg: ReturnType<typeof loadConfig>;
  try { cfg = loadConfig(dir); } catch (e) { errors.push(`${shown}: ${e instanceof Error ? e.message : String(e)}`); continue; }
  const fonts = outlineFontCheck(cfg.fonts);
  if (!fonts.ok) { errors.push(`${shown}: the slides are drawn with the text outlined, from the font files, and these are missing: ${fonts.missing.join(', ')} (name them in .svg-diagram.json "fonts", relative to it)`); continue; }
  for (const f of fonts.files) reads.add(path.resolve(dir, f));
  configureMeasure(cfg);
  if (currentMeasure().backend === 'chromium') chromium = true;
  const got = loadDeck(d.deck);
  if (!got.ok) { errors.push(...got.errors); continue; }
  for (const f of got.loaded.files) reads.add(f);
  for (const f of got.loaded.sources.values()) reads.add(f);
  const t0 = Date.now();
  let r: Awaited<ReturnType<typeof renderDeck>>;
  try { r = await renderDeck(got.loaded, cfg); } catch (e) { errors.push(`${shown}: ${e instanceof Error ? e.stack ?? e.message : String(e)}`); continue; }
  for (const w of r.warnings) console.error(`⚠ ${shown}: ${w}`);
  if (r.errors.length || r.slides.some(s => s === null)) { errors.push(...r.errors.map(e => `${shown}: ${e}`)); continue; }
  const slides = r.slides as RenderedSlide[];
  const title = d.title || r.title || slides[0]?.title || path.basename(d.deck, '.json');
  drawn.push({deck: d, slug, title, slides});
  console.log(`✓ ${slug}/: ${slides.length} slides (${Date.now() - t0} ms)  ${shown}`);
}
recordResolved(null);
recordImageReads(null);
await closeMeasurer();
if (chromium) console.error('⚠ a project measures text with Chromium: the result depends on its version, and the outlines come from the font files');
if (errors.length) fail([...errors, 'nothing was written (the site is written only when every slide is drawn)']);

// nothing read may be inside DIR: replacing DIR would delete it (D10)
const inside = [...reads, ...(siteFile ? [siteFile] : []), ...plan.extra.map(x => x.from)].filter(f => isInside(f, out));
if (inside.length) fail([`--out ${out} holds files the site is made from, which replacing it would delete: ${[...new Set(inside)].slice(0, 5).join(', ')}: write the site elsewhere`]);

// --- the files (D2) ---------------------------------------------------------------------------------------------------------------
const hash = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex').slice(0, 16);
const files = new Map<string, string | Buffer>();
const js = `assets/present.${hash(PRESENT_JS)}.js`, css = `assets/present.${hash(PRESENT_CSS)}.css`, siteCss = `assets/site.${hash(SITE_CSS)}.css`;
files.set(js, PRESENT_JS); files.set(css, PRESENT_CSS); files.set(siteCss, SITE_CSS);
const deckAssets = {js: `../${js}`, css: `../${css}`, csp: PAGE_CSP_META};
const viewerCfg: PageConfig = {role: 'viewer', transport: 'static', events: '', slides: 'slides.json', print: 'print.html'};
const manifestDecks: ManifestDeck[] = [];
for (const d of drawn) {
  files.set(`${d.slug}/index.html`, viewerPage(d.title, viewerCfg, deckAssets));
  files.set(`${d.slug}/print.html`, printPage(d.title, d.slides.map(s => ({url: `s/${s.hash}.svg`, text: s.text})), deckAssets));
  files.set(`${d.slug}/slides.json`, slidesJson(d.title, d.slides));
  for (const s of d.slides) files.set(`${d.slug}/s/${s.hash}.svg`, s.svg);
  manifestDecks.push({slug: d.slug, title: d.title, slides: d.slides.length, cover: `${d.slug}/s/${(d.slides[0] as RenderedSlide).hash}.svg`});
}
const siteTitle = plan.title || (drawn.length === 1 ? (drawn[0] as Drawn).title : 'スライド');
files.set('index.html', siteIndexPage(siteTitle, manifestDecks.map(m => ({href: `${m.slug}/`, title: m.title, slides: m.slides, cover: m.cover})), {css: siteCss, csp: PAGE_CSP_META}));
files.set('_headers', headersFile());
for (const x of plan.extra) files.set(x.to, fs.readFileSync(x.from));
files.set('manifest.json', manifestJson(siteTitle, [...files.keys(), 'manifest.json'], manifestDecks));

// --- written beside DIR, then put in its place (D10) -----------------------------------------------------------------------------
fs.mkdirSync(parent, {recursive: true});
const tmp = path.join(parent, `${tmpPrefix}${randomBytes(4).toString('hex')}`);
try {
  for (const [rel, body] of files) {
    const f = path.join(tmp, ...rel.split('/'));
    fs.mkdirSync(path.dirname(f), {recursive: true});
    fs.writeFileSync(f, body);
  }
} catch (e) {
  fs.rmSync(tmp, {recursive: true, force: true});
  fail([`cannot write ${tmp}: ${e instanceof Error ? e.message : String(e)}`]);
}
checkOut(true, () => fs.rmSync(tmp, {recursive: true, force: true})); // again: someone may have added to DIR while the decks were drawn
const old = fs.existsSync(out) ? path.join(parent, `${oldPrefix}${randomBytes(4).toString('hex')}`) : null;
try {
  if (old) fs.renameSync(out, old);
} catch (e) {
  fs.rmSync(tmp, {recursive: true, force: true});
  fail([`cannot move ${out} aside (${e instanceof Error ? (e as NodeJS.ErrnoException).code ?? e.message : String(e)}): nothing was changed. Is it a mount point, or is its parent folder read-only?`]);
}
try {
  fs.renameSync(tmp, out);
} catch (e) {
  let back = '';
  if (old) { try { fs.renameSync(old, out); back = ' (the site before is back)'; } catch { back = ` (the site before is at ${old}: rename it to ${out})`; } }
  fs.rmSync(tmp, {recursive: true, force: true});
  fail([`cannot put the new site at ${out} (${e instanceof Error ? (e as NodeJS.ErrnoException).code ?? e.message : String(e)})${back}`]);
}
if (old) { try { fs.rmSync(old, {recursive: true, force: true}); } catch (e) { console.error(`⚠ the new site is in place, but the one before could not be deleted: ${old} (${e instanceof Error ? (e as NodeJS.ErrnoException).code ?? e.message : String(e)}); delete it yourself`); } }

// --- what was written (D11: the host's limits are the host's; the largest file and the count are told) ----------------------------------
let largest = {rel: '', size: 0};
for (const [rel, body] of files) { const n = Buffer.byteLength(body); if (n > largest.size) largest = {rel, size: n}; }
const mib = (n: number) => `${(n / 1048576).toFixed(n < 1048576 ? 2 : 1)} MiB`;
console.log(`\n✓ ${out}: ${drawn.length} decks, ${files.size} files (largest: ${largest.rel}, ${mib(largest.size)})`);
console.log('  deploy it, for example to Cloudflare (Workers static assets): npx wrangler deploy   (see docs/deck-site-deploy.md)');
