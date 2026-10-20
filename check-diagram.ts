#!/usr/bin/env node
// svg-diagram check — rules, drift and document checks (nothing is written to the diagrams).
//
//   svg-diagram check [--strict] [--forbid-draft] [--verbose] <source.ts>...
//       Lay the diagram out and run the rules (lib/rules.ts): WCAG contrast, legend, lane order,
//       edge crossings, width, density, wireframe callouts and state matrices ... Exit 1 on a layout error,
//       or on any warning with --strict.
//       --forbid-draft: a figure still marked diagram({status: 'draft'}) is a warning (else the info `draft-status`); for the publishing job only.
//   svg-diagram check --drift [--svg-dir DIR] [--rebuild] <source.ts>...
//   svg-diagram check [--today YYYY-MM-DD] ...   the day for gantt({today: 'auto'}) (else SVG_DIAGRAM_TODAY, else "today" in .svg-diagram.json)
//       Compare each source's SHA-256 with the one embedded in the committed SVG (<metadata id="svg-diagram">),
//       so an SVG that was not regenerated after its source — or a local file it imports — changed is caught. DIR defaults to ./svg.
//       --rebuild also regenerates each SVG in memory and compares the bytes; a difference is explained
//       (metadata only? text moved? shapes added?), so you can tell whether regenerating is safe.
//       --rebuild is fast on a big set: sources are rebuilt in parallel (--jobs N; by default as many as there are idle cores, at most 8, and at least 8 sources each; --jobs 1 = serial),
//       and a source that passed once is not rebuilt until something it depends on changes (--no-cache turns that off, --cache-dir DIR moves it
//       from ./.svg-diagram-cache). The output is in the order of the arguments either way. See ADR 0037.
//   svg-diagram check --docs PATH... [--only GLOB]... [--svg-dir DIR] [--src-dir DIR]
//       Do the Markdown pages and the diagrams still agree? PATH is a directory (searched for .md) or one .md file; repeat --docs for several.
//       Referenced SVGs exist, alt text is short and present, figure captions 図N-M are in order, 図N-M in the text names a real figure,
//       no SVG is left unreferenced (--svg-dir), and the numbered notes under a figure match the figure's own notes (--src-dir).
//       --only GLOB (repeatable, e.g. 'docs/03-*.md') keeps just the matching pages. Whenever the pages are narrowed (a .md file or --only),
//       the orphan-SVG check is skipped (it needs every page to know what is unreferenced) and a note says so.
//       --map prints the figure <-> document table (Markdown) on stdout instead; the findings go to stderr.
//   svg-diagram check --docs ... --fidelity [--base REF]
//       The other way round: a number (two digits or more) or a Latin word in a figure's text that the page never writes (doc-fidelity-missing).
//       --base REF also accepts what the page said at REF (so a figure drawn from the older text is not flagged for the words the rewrite dropped).
//   svg-diagram check --covers TABLE.md|TABLE.csv [--svg-dir DIR] <source.ts|file.svg>...
//       Does the figure that replaces a table still carry the table's cells? Each cell is looked up in the figure's <text>
//       (width, case, spaces and punctuation ignored); a cell that is not there whole is judged by its proper-noun and number tokens,
//       and the missing ones are listed. A source is read through its committed SVG (DIR defaults to ./svg).
//   svg-diagram check --changed[=REF] <source.ts>...   (with any per-diagram mode)
//       Only the sources that changed: the source itself, a local file it imports, its committed SVG (--drift), or .svg-diagram.json
//       (then all of them) — in the working tree and in the commits since REF (default: the merge-base with origin/main or main, else HEAD).
//       Nothing changed → nothing to check, exit 0. A quick check while editing, and a fast pull-request check on a big diagram set.
//   svg-diagram check --rules | --explain RULE
//       List every rule id, or explain one (what it means, how to accept it in .svg-diagram.json).
//   svg-diagram check --write-baseline FILE <...>   /   --baseline FILE <...>
//       Adopt the checker in a project that already has warnings: --write-baseline records today's warnings in FILE (JSON),
//       --baseline FILE then reports only warnings that are NOT in it (the recorded ones become info). Errors are never baselined.
//   Any mode:  --format text|json|github|sarif   (github = ::warning annotations for a pull request, sarif = SARIF 2.1.0 for code scanning)
//   Project settings (accepted rules, max width) come from .svg-diagram.json, found by walking up from the current directory.

import fs from 'fs';
import path from 'path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import type {DriftCache} from './drift-cache-io.ts';
import type {WorkerResult} from './drift-pool.ts';
import type {FindingData} from './lib/types/verdicts.ts';
import type {MapRow} from './lib/docs-check.ts';
import {installResolveHook} from './lib/resolve-hook.ts';
installResolveHook();
const {checkDiagram, build, closeMeasurer} = await import('./lib/dsl.ts');
const {depsSha256} = await import('./lib/source-deps.ts');
const {RULE_DOCS} = await import('./lib/rules.ts');
const {selectChanged} = await import('./lib/changed.ts');
const {scanPngRefs, scanMarkdown, compareNotes, notesOf, formatMap, checkFigures, chapterOf, globToRegExp, matchesAny} = await import('./lib/docs-check.ts');
const {explainChange} = await import('./lib/svg-diff.ts');
const {loadConfig} = await import('./lib/config.ts');
const {checkToday} = await import('./lib/today.ts');
const {loadDiagram} = await import('./lib/load-source.ts');
const {readTable, figureText, checkCovers, checkFidelity} = await import('./lib/covers.ts');
const {formatBuildError, errorMessage} = await import('./lib/error-format.ts');
const {readProvenance, sha256File: sha} = await import('./lib/freshness.ts');

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const val = (n: string) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1] ?? null; };
const VALUE_FLAGS = ['--svg-dir', '--src-dir', '--docs', '--covers', '--format', '--only', '--explain', '--baseline', '--write-baseline', '--today', '--base', '--jobs', '--cache-dir'];
const vals = (n: string) => args.flatMap((a, i) => { const next = args[i + 1]; return a === n && next !== undefined ? [next] : []; });
// --docs takes the path after it, and every following .md file / directory too (`--docs A.md B.md dir`): those are documents, never sources
const isDocArg = (a: string) => !a.startsWith('--') && (a.toLowerCase().endsWith('.md') || (fs.existsSync(a) && fs.statSync(a).isDirectory()));
const docsArgIdx = new Set<number>();
args.forEach((a, i) => { if (a === '--docs') for (let j = i + 1; j < args.length && (j === i + 1 ? !(args[j] ?? '--').startsWith('--') : isDocArg(args[j] ?? '')); j++) docsArgIdx.add(j); });
const NON_DIAGRAM_RULES: Record<string, string> = {
  'layout': '図が置けない（重なり・はみ出し・幅超過など）。メッセージに直し方がある。許容できない（accept できない）エラー',
  'drift-missing': '--drift: ソースに対応する SVG がない（未生成）',
  'drift-no-provenance': '--drift: SVG に生成元の情報（<metadata id="svg-diagram">）がない',
  'drift-stale': '--drift: ソースが変わっているのに SVG が再生成されていない',
  'drift-stale-deps': '--drift: ソースが import しているファイルが変わっているのに SVG が再生成されていない',
  'drift-rebuild': '--drift --rebuild: 再生成した SVG が、コミット済みの SVG と一致しない',
  'drift-rebuild-failed': '--drift --rebuild: 再生成した SVG が自分の検査に通らない',
  'drift-orphan-reveal': '--drift: 段階表示の段数を減らしたのに、古い reveal ファイルが残っている',
  'covers-missing': '--covers: 表のセルの語・数値が図に残っていない',
  'covers-missing-svg': '--covers: 図の SVG がない（未生成）',
  'doc-fig-number': '--docs: 図の番号 図N-M が順番どおりでない',
  'doc-fig-ref-missing': '--docs: 本文の 図N-M が、実在する図を指していない',
  'doc-notes-number': '--docs: 図の下の注釈の番号が連番でない',
  'doc-alt-placeholder': '--docs: 代替テキストが仮のまま（画像・図 など）',
  'doc-fidelity-missing': '--docs --fidelity: 図の文字にある数値（2 桁以上）・英数字の語が、その図を参照する文書（--base REF があればその版も）のどこにも書かれていない',
};
const explain = val('--explain');
if (explain !== null || flag('--rules')) {
  const all: Record<string, string> = {...RULE_DOCS, ...NON_DIAGRAM_RULES};
  if (explain === null) { for (const [k, v] of Object.entries(all).sort(([a], [b]) => a.localeCompare(b))) console.log(`${k}\t${v}`); process.exit(0); }
  const doc = all[explain];
  if (!doc) {
    const near = Object.keys(all).filter(k => k.includes(explain) || explain.includes(k) || k.split('-')[0] === explain.split('-')[0]).slice(0, 8);
    console.error(`✗ ルール "${explain}" はない。${near.length ? `似た名前: ${near.join(', ')}。` : ''}一覧は svg-diagram check --rules`); process.exit(2);
  }
  console.log(`${explain}\n  ${doc}`);
  if (Object.hasOwn(RULE_DOCS, explain)) console.log(`\n許容するとき（理由が要る）:\n  案件全体: .svg-diagram.json の {"accept": {"${explain}": "なぜ問題ないか"}}\n  その図だけ: diagram({accept: {'${explain}': 'なぜ問題ないか'}})\n  （許容した指摘は info に下がり、理由が添えられる）`);
  process.exit(0);
}
/** The page as it was at REF (undefined when it did not exist there or git cannot say). */
const gitShow = (ref: string, file: string): string | undefined => { try { return execFileSync('git', ['-C', path.dirname(file), 'show', `${ref}:./${path.basename(file)}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}); } catch { return undefined; } };
const fidelity = flag('--fidelity'), fidelityBase = val('--base');
const strict = flag('--strict'), verbose = flag('--verbose'), drift = flag('--drift'), rebuild = flag('--rebuild'), forbidDraft = flag('--forbid-draft');
const mapMode = flag('--map');
if (mapMode && (!val('--docs') || (val('--format') ?? 'text') !== 'text')) { console.error('--map は --docs と一緒に、--format text で使う（表を標準出力に出す）'); process.exit(2); }
const svgDir = val('--svg-dir'), srcDir = val('--src-dir'), docsDirs = args.filter((_, i) => docsArgIdx.has(i)), docsDir = docsDirs[0], coversFile = val('--covers'), only = vals('--only').map(globToRegExp), format = val('--format') ?? 'text';
const sources = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1] ?? '') && !docsArgIdx.has(i));
for (const s of sources) {
  const ok = coversFile && s.toLowerCase().endsWith('.svg') ? true : /\.(ts|mts|cts|js|mjs|cjs)$/i.test(s);
  if (!ok) { console.error(`✗ ${s}: 図のソース（.ts / .mjs）ではない。${/\.md$/i.test(s) ? '文書は --docs ' + s + ' で渡す' : '図のソースを指定する'}`); process.exit(2); }
}
if (!['text', 'json', 'github', 'sarif'].includes(format)) { console.error(`--format must be text, json, github or sarif (got "${format}")`); process.exit(2); }
if (!sources.length && !docsDir && !flag('--worker')) { console.error('Usage: svg-diagram check [--strict] [--forbid-draft] [--verbose] [--drift [--svg-dir DIR] [--rebuild]] [--today YYYY-MM-DD] [--docs PATH... [--only GLOB]... [--svg-dir DIR] [--src-dir DIR] [--map]] [--covers TABLE.md|TABLE.csv [--svg-dir DIR]] [--format text|json|github|sarif] [--baseline FILE | --write-baseline FILE] <source.ts>...\n       svg-diagram check --rules | --explain RULE'); process.exit(2); }
const config = loadConfig();
try { const t = val('--today'); if (args.includes('--today') && (t == null || t.startsWith('--'))) throw new Error('--today needs a date (YYYY-MM-DD)'); if (t) config._today = checkToday(t, '--today'); } catch (e) { console.error(`✗ ${(e as Error).message}`); process.exit(2); } // the day for gantt({today: 'auto'}) (ADR 0022)
let coverCells: ReturnType<typeof readTable> = [];
if (coversFile) {
  if (!fs.existsSync(coversFile)) { console.error(`--covers: ${coversFile} がない`); process.exit(2); }
  coverCells = readTable(fs.readFileSync(coversFile, 'utf8'), coversFile.toLowerCase().endsWith('.csv') ? 'csv' : 'md');
  if (!coverCells.length) { console.error(`--covers: ${coversFile} に表がない（Markdown は見出し行と |---| の行が要る）`); process.exit(2); }
}

const workerOut: string[] = [], workerErr: string[] = []; // --worker: the lines of the source in hand, sent back instead of printed
const say = (...a: unknown[]) => { if (flag('--worker')) workerOut.push(a.join(' ')); else if (format === 'text') (mapMode ? console.error : console.log)(...a); };
const complain = (...a: unknown[]) => { if (flag('--worker')) workerErr.push(a.join(' ')); else if (format === 'text') console.error(...a); };
const changedArg = args.find(a => a === '--changed' || a.startsWith('--changed='));
if (changedArg && !sources.length) { console.error('--changed は図のソースと一緒に使う（変わったものだけを検査する）'); process.exit(2); }
if (changedArg) {
  const ref = changedArg.includes('=') ? changedArg.slice('--changed='.length) : null;
  const git = (a: string[]) => { try { return execFileSync('git', a, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}); } catch (e) { console.error(`--changed: git が使えない（${String((e as {stderr?: Buffer}).stderr ?? e).trim().split('\n')[0]}）`); process.exit(2); } };
  const top = git(['rev-parse', '--show-toplevel']).trim();
  let base = ref;
  if (!base) for (const b of ['origin/main', 'main']) { try { base = execFileSync('git', ['merge-base', b, 'HEAD'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); break; } catch { /* no such branch */ } }
  const lines = (o: string) => o.split('\n').filter(Boolean).map(f => path.join(top, f));
  const changed = new Set([...lines(git(['diff', '--name-only', base ?? 'HEAD', '--'])), ...lines(git(['ls-files', '--others', '--exclude-standard']))]);
  const svgOf = (s: string) => drift ? path.join(svgDir ?? 'svg', `${path.parse(s).name}.svg`) : undefined;
  const {selected, skipped, reason} = selectChanged(sources, {changed, svgOf});
  say(`ℹ --changed（${base ? base.slice(0, 10) : 'HEAD'} から）: ${sources.length} 件中 ${selected.length} 件を検査、${skipped.length} 件は変わっていない`);
  for (const s of selected) if (verbose) say(`   ${s}: ${reason.get(s)}`);
  sources.splice(0, sources.length, ...selected);
  if (!sources.length && !docsDir) { if (format === 'json') console.log(JSON.stringify({errors: 0, warnings: 0, findings: []}, null, 2)); if (format === 'sarif') console.log(JSON.stringify({version: '2.1.0', runs: [{tool: {driver: {name: 'svg-diagram check'}}, results: []}]})); process.exit(0); }
}
type CheckFinding = {file: string; line?: number; rule: string; severity: 'error' | 'warn' | 'info'; message: string; /* --format json only: what was measured against which threshold, and how to fix it */ data?: FindingData};
const findings: CheckFinding[] = [];
let bad = 0, warned = 0;
// a source that does not load is one finding, however many times it is reached (named as an argument and behind a figure): counted once
const failedSources = new Set<string>();
const reportBuildError = (file: string, err: unknown) => {
  const key = path.resolve(file);
  if (failedSources.has(key)) return;
  failedSources.add(key);
  add({file, rule: 'build-error', severity: 'error', message: errorMessage(err)});
  complain(formatBuildError(file, err));
};
// --baseline: warnings recorded in the baseline file become info (errors never do), so --strict fails only on new ones
const fingerprint = (f: {file: string; rule: string; message: string}) => `${f.file}\u0000${f.rule}\u0000${f.message}`;
const baselineFile = val('--baseline'), writeBaseline = val('--write-baseline');
if (baselineFile && writeBaseline) { console.error('--baseline と --write-baseline は同時に使えない'); process.exit(2); }
const baselined = new Set<string>();
if (baselineFile) {
  if (!fs.existsSync(baselineFile)) { console.error(`--baseline: ${baselineFile} がない（--write-baseline ${baselineFile} で作る）`); process.exit(2); }
  try { for (const e of JSON.parse(fs.readFileSync(baselineFile, 'utf8')).warnings as {file: string; rule: string; message: string}[]) baselined.add(fingerprint(e)); }
  catch { console.error(`--baseline: ${baselineFile} を読めない（--write-baseline で作ったJSONではない）`); process.exit(2); }
}
const applyBaseline = <T extends {rule: string; severity: string; message: string}>(file: string, f: T): T =>
  f.severity === 'warn' && baselined.has(fingerprint({file, rule: f.rule, message: f.message})) ? {...f, severity: 'info', message: `${f.message}（ベースライン済み）`} : f;
const add = (f0: CheckFinding) => { const f = applyBaseline(f0.file, f0); findings.push(f); if (f.severity === 'error') bad++; else if (f.severity === 'warn') warned++; };

function walkMd(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['html', 'node_modules', '.git'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(f, out); else if (e.name.endsWith('.md')) out.push(f);
  }
  return out;
}

// ---- --drift --rebuild: parallel and cached (ADR 0037) ---------------------------------------------------------------------
const jobs = val('--jobs') === null ? Math.min(os.availableParallelism(), 8) : Number(val('--jobs')); // without --jobs: fewer when the machine is busy or the work is small (below)
if (!Number.isInteger(jobs) || jobs < 1) { console.error('--jobs は 1 以上の整数（1 = 順番に処理する）'); process.exit(2); }
const cacheDir = val('--cache-dir') ?? path.join(process.cwd(), '.svg-diagram-cache');
let cacheOpened: Promise<DriftCache | null> | undefined;
const driftCacheOf = (): Promise<DriftCache | null> => cacheOpened ??= flag('--no-cache') ? Promise.resolve(null) : import('./drift-cache-io.ts').then(m => m.openDriftCache(cacheDir, config));
/** The cache key of a source whose committed SVG exists and carries provenance (null: nothing to key, or not cacheable) */
const rebuildKeyOf = async (src: string): Promise<string | null> => {
  const cache = await driftCacheOf();
  const svg = path.join(svgDir ?? 'svg', `${path.parse(src).name}.svg`);
  if (!cache || !fs.existsSync(svg)) return null;
  const meta = readProvenance(svg);
  return meta ? cache.keyFor(path.resolve(src), svg, JSON.stringify(meta)) : null;
};
/** The sources the cache does not vouch for are rebuilt by child processes (dynamic hand-out, as many as --jobs). Their answers come back by source and are replayed in order. */
async function rebuildInParallel(): Promise<Map<string, WorkerResult>> {
  if (jobs < 2 || flag('--worker')) return new Map();
  const cache = await driftCacheOf(), todo: string[] = [];
  for (const src of sources) {
    const key = await rebuildKeyOf(src);
    if (!(cache && key && cache.hit(path.resolve(src), key))) todo.push(src);
  }
  // A child costs about 2 s to start, so by default: no more than the cores that are idle, and at least 8 sources each (--jobs N is taken as given)
  const workers = val('--jobs') !== null ? jobs : Math.min(jobs, Math.round(os.availableParallelism() - (os.loadavg()[0] ?? 0)), Math.floor(todo.length / 8));
  if (todo.length < 2 || workers < 2) return new Map();
  const {runPool} = await import('./drift-pool.ts');
  const t = val('--today');
  const wargs = ['--drift', '--rebuild', '--jobs', '1', ...(svgDir ? ['--svg-dir', svgDir] : []), ...(t ? ['--today', t] : []), ...(flag('--no-cache') ? ['--no-cache'] : ['--cache-dir', cacheDir])];
  return runPool(path.resolve(import.meta.dirname, path.basename(import.meta.filename)), wargs, todo, workers, msg => console.error(`ℹ ${msg}（その図は順番に検査し直す）`));
}

try {
  // ---- documents <-> diagrams ----------------------------------------------------------------
  if (docsDir) {
    const referenced = new Set<string>();
    const mapRows: MapRow[] = [];
    const pngReferenced = new Set<string>(), pngDirs = new Set<string>();
    const pages = new Set<string>();
    let scoped = only.length > 0;
    for (const p of docsDirs) {
      if (!fs.existsSync(p)) { console.error(`--docs ${p} がない`); process.exit(2); }
      if (fs.statSync(p).isDirectory()) walkMd(p).forEach(f => pages.add(path.resolve(f)));
      else if (p.endsWith('.md')) { pages.add(path.resolve(p)); scoped = true; }
      else { console.error(`--docs ${p}: ディレクトリか .md ファイルを指定する`); process.exit(2); }
    }
    const inScope = [...pages].sort().filter(md => matchesAny(only, path.relative(process.cwd(), md)));
    if (only.length && !inScope.length) { console.error(`--only ${vals('--only').join(' ')} に合う文書がない（カレントからの相対パスかファイル名に合わせる）`); process.exit(2); }
    for (const md of inScope) {
      const rel = path.relative(process.cwd(), md);
      const text = fs.readFileSync(md, 'utf8');
      const figs = scanMarkdown(text);
      for (const f of checkFigures(text, figs, chapterOf(path.basename(md)))) add({file: rel, ...f});
      for (const png of scanPngRefs(text)) {
        if (/^(https?:|data:)/.test(png.ref)) continue;
        let ref = png.ref;
        try { ref = decodeURI(ref); } catch { /* a stray % stays as written */ }
        const abs = path.resolve(path.dirname(md), ref), name = path.basename(abs).replace(/\.png$/i, '');
        if (!fs.existsSync(abs)) { add({file: rel, line: png.line, rule: 'doc-image-missing', severity: 'error', message: `${png.ref} がない`}); continue; }
        pngReferenced.add(abs); pngDirs.add(path.dirname(abs));
        // a raster copy of a figure has a source or an SVG of the same name; one with neither is a hand-made or stale picture
        const hasSrc = srcDir && ['.ts', '.mjs'].some(ext => fs.existsSync(path.join(srcDir, name + ext))), hasSvg = svgDir && fs.existsSync(path.join(svgDir, name + '.svg'));
        if ((srcDir || svgDir) && !hasSrc && !hasSvg) add({file: rel, line: png.line, rule: 'doc-png-no-source', severity: 'warn', message: `${name}.png に対応する図のソース${srcDir ? `（${srcDir}/${name}.ts）` : ''}も SVG${svgDir ? `（${svgDir}/${name}.svg）` : ''}もない`});
        const alt = png.alt.trim();
        if (!alt) add({file: rel, line: png.line, rule: 'doc-alt-empty', severity: 'warn', message: `${name}.png: 代替テキストが空`});
        else if ([...alt].length > 155) add({file: rel, line: png.line, rule: 'doc-alt-long', severity: 'warn', message: `${name}.png: 代替テキストが ${[...alt].length} 文字（155 文字以内にして、詳しい説明は本文に）`});
      }
      let n = 0;
      for (const fig of figs) {
        if (/^https?:/.test(fig.ref)) continue;
        const abs = path.resolve(path.dirname(md), fig.ref), where = `${rel}:${fig.line}`, name = path.basename(fig.ref, '.svg');
        if (!fs.existsSync(abs)) { add({file: rel, line: fig.line, rule: 'doc-image-missing', severity: 'error', message: `${fig.ref} がない`}); continue; }
        referenced.add(abs);
        if (fidelity) {
          const older = fidelityBase ? gitShow(fidelityBase, md) : undefined;
          const missing = checkFidelity(figureText(fs.readFileSync(abs, 'utf8')), text, ...(older ? [older] : []));
          if (missing.length) add({file: rel, line: fig.line, rule: 'doc-fidelity-missing', severity: 'warn', message: `${name}: 図にあって文書に書かれていない数値・語 ${missing.length} 件: ${missing.slice(0, 8).map(m => `「${m}」`).join('')}${missing.length > 8 ? ` ほか ${missing.length - 8} 件` : ''}（本文に書くか、図から外す）`});
        }
        const alt = fig.alt.trim();
        if (!alt) add({file: rel, line: fig.line, rule: 'doc-alt-empty', severity: 'warn', message: `${name}: 代替テキストが空`});
        else if ([...alt].length > 155) add({file: rel, line: fig.line, rule: 'doc-alt-long', severity: 'warn', message: `${name}: 代替テキストが ${[...alt].length} 文字（155 文字以内にして、詳しい説明は本文に）`});
        const srcFile = srcDir && ['.ts', '.mjs'].map(ext => path.join(srcDir, name + ext)).find(f => fs.existsSync(f));
        mapRows.push({name, svg: path.relative(process.cwd(), abs), doc: where, src: srcFile ? path.relative(process.cwd(), srcFile) : ''});
        if (srcFile) {
          try {
            const d = await loadDiagram(path.resolve(srcFile), config);
            const sets = notesOf(d.bands);
            if (sets.length === 1) for (const f of compareNotes(fig.items, sets[0] ?? [], name)) add({file: rel, line: fig.line, ...f});
            else if (sets.length > 1) add({file: rel, line: fig.line, rule: 'doc-notes-mismatch', severity: 'info', message: `${name}: 注釈つきのワイヤーフレームが ${sets.length} 枚あり、突き合わせない`});
          } catch (err) { // the source behind this figure does not load: say so, and go on with the other figures and pages
            reportBuildError(path.relative(process.cwd(), path.resolve(srcFile)), err);
          }
        }
        n++;
      }
      if (n) say(`${findings.some(f => f.file === rel && f.severity !== 'info') ? '△' : '✓'} ${rel}（図 ${n}）`);
    }
    if (scoped && (svgDir || pngDirs.size)) say(`ℹ 文書を絞っているので、どの文書からも参照されていない ${[svgDir ? 'SVG（doc-orphan-svg）' : '', pngDirs.size ? 'PNG（doc-orphan-png）' : ''].filter(Boolean).join('・')}の検査は行わない（全文書を指定すると行う）`);
    else if (svgDir && fs.existsSync(svgDir)) {
      for (const f of fs.readdirSync(svgDir).filter(x => x.endsWith('.svg') && !/\.reveal\d+\.svg$/.test(x)).sort()) {
        if (!referenced.has(path.resolve(svgDir, f))) mapRows.push({name: path.parse(f).name, svg: path.join(svgDir, f), doc: '', src: ''});
        if (!referenced.has(path.resolve(svgDir, f))) add({file: path.join(svgDir, f), rule: 'doc-orphan-svg', severity: 'warn', message: 'どの文書からも参照されていない'});
      }
    }
    if (!scoped) for (const dir of [...pngDirs].sort()) for (const f of fs.readdirSync(dir).filter(x => x.toLowerCase().endsWith('.png')).sort()) {
      if (!pngReferenced.has(path.join(dir, f))) add({file: path.relative(process.cwd(), path.join(dir, f)), rule: 'doc-orphan-png', severity: 'warn', message: 'どの文書からも参照されていない PNG'});
    }
    if (mapMode) console.log(formatMap(mapRows));
    for (const f of findings) say(`   ${f.severity === 'error' ? '✗' : f.severity === 'warn' ? '⚠' : 'ℹ'} ${f.file}${f.line ? `:${f.line}` : ''} [${f.rule}] ${f.message}`);
  }

  // ---- per-diagram checks -----------------------------------------------------------------------
  // a source that cannot be loaded or laid out is one finding, not a stack trace, and the rest are still checked (ADR 0013)
  const checkOne = async (src: string): Promise<void> => {
    const abs = path.resolve(src);
    const name = path.parse(src).name;
    if (coversFile) {
      const svg = src.endsWith('.svg') ? src : path.join(svgDir ?? 'svg', `${name}.svg`);
      if (!fs.existsSync(svg)) { add({file: src, rule: 'covers-missing-svg', severity: 'error', message: `${svg} がない（未生成）`}); complain(`✗ ${src}: ${svg} がない（未生成）`); return; }
      const cells = coverCells;
      const lost = checkCovers(cells, figureText(fs.readFileSync(svg, 'utf8')));
      for (const u of lost) add({file: coversFile, line: u.cell.line, rule: 'covers-missing', severity: 'warn', message: `${name}: 「${u.cell.text}」が図にない（欠けた語: ${u.missing.join('、')}）`});
      say(`${lost.length ? '△' : '✓'} ${src}: 表のセル ${cells.length} 件中 ${lost.length} 件が図にない`);
      for (const u of lost) say(`   ⚠ ${coversFile}:${u.cell.line} [covers-missing] 「${u.cell.text}」（欠けた語: ${u.missing.join('、')}）`);
      return;
    }
    if (drift) {
      const svg = path.join(svgDir ?? 'svg', `${name}.svg`);
      if (!fs.existsSync(svg)) { add({file: src, rule: 'drift-missing', severity: 'error', message: `${svg} がない（未生成）`}); complain(`✗ ${src}: ${svg} がない（未生成）`); return; }
      const meta = readProvenance(svg);
      if (!meta) { add({file: src, rule: 'drift-no-provenance', severity: 'error', message: `${svg} に生成元の情報がない。再生成する`}); complain(`✗ ${src}: ${svg} に生成元の情報（<metadata id="svg-diagram">）がない。再生成する`); return; }
      if (meta.sourceSha256 !== sha(abs)) { add({file: src, rule: 'drift-stale', severity: 'error', message: `ソースが変わっているのに ${svg} が再生成されていない`}); complain(`✗ ${src}: ソースが変わっているのに ${svg} が再生成されていない`); return; }
      if ((meta.depsSha256 ?? '') !== depsSha256(abs)) { add({file: src, rule: 'drift-stale-deps', severity: 'error', message: `ソースが import しているファイル（共通部品など）が変わっているのに ${svg} が再生成されていない`}); complain(`✗ ${src}: import しているファイル（共通部品など）が変わっているのに ${svg} が再生成されていない`); return; }
      if (rebuild) {
        // a source that rebuilt to the committed bytes before, with nothing it depends on changed since, is not rebuilt (the key and the stored reads: lib/drift-cache.ts)
        const cache = await driftCacheOf(), key = await rebuildKeyOf(src);
        if (cache && key && cache.hit(abs, key)) { say(`✓ ${src}: ${svg} は最新（ツール ${meta.toolVersion}）`); return; }
        const record = cache ? (await import('./drift-cache-io.ts')).recordReads : <T,>(f: () => Promise<T>) => f();
        const d = await record(() => loadDiagram(abs, config));
        if (meta.noSourceLine) d.sourceLine = undefined; // ADR 0023 D13: rebuild the way the SVG was built
        d.source = meta; // same provenance → byte-comparable
        if (meta.today !== undefined) d.today = meta.today; // a today: 'auto' figure is drawn again with the day it was drawn with
        const tmp = path.join(path.dirname(svg), `.${name}.rebuild.svg`);
        let rebuilt: Awaited<ReturnType<typeof build>>;
        try { rebuilt = await record(() => build(d, tmp, {lint: false, name: `${name}.svg`})); } // the committed SVG was linted when it was built; an identical rebuild needs no second render
        catch (e) { // the regenerated picture fails its own checks: report it and go on with the rest
          fs.rmSync(tmp, {force: true});
          const why = String((e as Error).message).split('\n').filter(l => l.trim() && !/^Scanned|^─/.test(l)).slice(0, 3).join(' / ');
          add({file: src, rule: 'drift-rebuild-failed', severity: 'error', message: `再生成した SVG が自分の検査に通らない: ${why}`});
          complain(`✗ ${src}: 再生成した SVG が自分の検査に通らない: ${why}`);
          return;
        }
        const pairs: [string, string][] = [[svg, tmp], ...rebuilt.revealPaths.map((p, stage): [string, string] => [path.join(path.dirname(svg), `${name}.reveal${stage}.svg`), p])];
        const orphaned = fs.readdirSync(path.dirname(svg)).filter(f => {
          const m = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.reveal(\\d+)\\.svg$`).exec(f);
          return m && Number(m[1]) >= rebuilt.revealPaths.length;
        });
        const changed = pairs.find(([beforePath, afterPath]) => !fs.existsSync(beforePath) || fs.readFileSync(beforePath, 'utf8') !== fs.readFileSync(afterPath, 'utf8'));
        if (orphaned.length) {
          for (const [, p] of pairs) fs.rmSync(p, {force: true});
          add({file: src, rule: 'drift-orphan-reveal', severity: 'error', message: `古い reveal ファイルが残っている: ${orphaned.join(', ')}`});
          complain(`✗ ${src}: 古い reveal ファイルが残っている: ${orphaned.join(', ')}`);
          return;
        }
        if (changed) {
          const [beforePath, afterPath] = changed;
          if (!fs.existsSync(beforePath)) {
            for (const [, p] of pairs) fs.rmSync(p, {force: true});
            add({file: src, rule: 'drift-missing', severity: 'error', message: `${beforePath} がない（未生成）`});
            complain(`✗ ${src}: ${beforePath} がない（未生成）`);
            return;
          }
          const before = fs.readFileSync(beforePath, 'utf8'), after = fs.readFileSync(afterPath, 'utf8');
          for (const [, p] of pairs) fs.rmSync(p, {force: true});
          const ex = explainChange(before, after);
          add({file: src, rule: 'drift-rebuild', severity: 'error', message: `再生成した SVG が ${beforePath} と一致しない（ツールの版が違う、または手で編集された）。${ex.lines.join(' / ')}`});
          complain(`✗ ${src}: 再生成した SVG が ${beforePath} と一致しない（ツールの版が違う、または手で編集された）`);
          for (const l of ex.lines) complain(`     ↳ ${l}`);
          complain(`     ↳ ${ex.visual ? '見た目が変わる。再生成して、目で確かめる' : '見た目は変わらない。再生成してよい'}`);
          return;
        }
        for (const [, p] of pairs) fs.rmSync(p, {force: true});
        if (cache && key) cache.store(abs, key);
      }
      say(`✓ ${src}: ${svg} は最新（ツール ${meta.toolVersion}）`);
      return;
    }
    const d = await loadDiagram(abs, config);
    const {verdict} = await checkDiagram(d);
    if (!verdict.ok) { for (const p of verdict.problems) add({file: src, rule: 'layout', severity: 'error', message: p}); complain(`✗ ${src}:\n  ${verdict.problems.join('\n  ')}`); return; }
    // --forbid-draft (a publishing job): a figure still marked as a draft is a warning (an accepted one stays info)
    const shown = verdict.findings.map(f => forbidDraft && f.rule === 'draft-status' && !f.message.includes('（許容:') ? {...f, severity: 'warn' as const, message: `${f.message}（--forbid-draft）`} : f).map(f => applyBaseline(src, f));
    for (const f of shown) add({file: src, rule: f.rule, severity: f.severity, message: f.message, ...(f.data ? {data: f.data} : {})});
    const w = shown.filter(f => f.severity === 'warn').length;
    say(`${w ? '△' : '✓'} ${src}${w ? `（警告 ${w}）` : ''}`);
    for (const f of shown.filter(f => verbose || f.severity === 'warn')) say(`   ${f.severity === 'warn' ? '⚠' : 'ℹ'} [${f.rule}] ${f.message}`);
  };
  const runOne = async (src: string) => {
    try { await checkOne(src); }
    catch (err) { reportBuildError(src, err); }
  };
  if (flag('--worker')) { // a child of the pool below: one source per line on stdin, one result line per source on stdout (drift-pool.ts)
    const {RESULT_MARK} = await import('./drift-pool.ts');
    const rl = (await import('node:readline')).createInterface({input: process.stdin});
    for await (const src of rl) {
      if (!src) continue;
      const before = findings.length;
      await runOne(src);
      process.stdout.write(`${RESULT_MARK}${JSON.stringify({src, out: workerOut, err: workerErr, findings: findings.slice(before)})}\n`);
      workerOut.length = 0; workerErr.length = 0;
    }
  } else {
    const pooled = drift && rebuild ? await rebuildInParallel() : new Map<string, WorkerResult>();
    for (const src of sources) {
      const r = pooled.get(src);
      if (!r) { await runOne(src); continue; }
      for (const l of r.out) say(l);
      for (const l of r.err) complain(l);
      for (const f of r.findings as CheckFinding[]) { findings.push(f); if (f.severity === 'error') bad++; else if (f.severity === 'warn') warned++; if (f.rule === 'build-error') failedSources.add(path.resolve(f.file)); }
    }
  }
  if (failedSources.size) complain(`${new Set([...sources.map(x => path.resolve(x)), ...failedSources]).size} 件中 ${failedSources.size} 件が検査できなかった`);
} finally {
  await closeMeasurer();
}
if (flag('--worker')) process.exit(0); // a pool child has answered line by line; the summary belongs to the parent

if (writeBaseline) {
  const warnings = findings.filter(f => f.severity === 'warn').map(({file, rule, message}) => ({file, rule, message}));
  fs.writeFileSync(writeBaseline, JSON.stringify({version: 1, warnings}, null, 2) + '\n');
  console.error(`ℹ ベースライン ${writeBaseline} に警告 ${warnings.length} 件を記録した（--baseline ${writeBaseline} で、これ以外の新しい警告だけを報告する）`);
}
if (format === 'sarif') {
  const ruleIds = [...new Set(findings.map(f => f.rule))].sort();
  const docs: Record<string, string> = {...RULE_DOCS, ...NON_DIAGRAM_RULES};
  console.log(JSON.stringify({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json', version: '2.1.0',
    runs: [{
      tool: {driver: {name: 'svg-diagram check', rules: ruleIds.map(id => ({id, shortDescription: {text: docs[id] ?? id}}))}},
      results: findings.map(f => ({
        ruleId: f.rule, level: f.severity === 'error' ? 'error' : f.severity === 'warn' ? 'warning' : 'note', message: {text: f.message},
        locations: [{physicalLocation: {artifactLocation: {uri: f.file.split(path.sep).join('/')}, ...(f.line ? {region: {startLine: f.line}} : {})}}],
      })),
    }],
  }, null, 2));
}
if (format === 'json') console.log(JSON.stringify({errors: bad, warnings: warned, findings}, null, 2));
if (format === 'github') {
  for (const f of findings.filter(f => f.severity !== 'info')) {
    const lvl = f.severity === 'error' ? 'error' : 'warning';
    console.log(`::${lvl} file=${f.file}${f.line ? `,line=${f.line}` : ''},title=${f.rule}::${f.message.replace(/\n/g, ' ')}`);
  }
}
if (verbose && !drift && format === 'text') console.log('\nルール:\n' + Object.entries(RULE_DOCS).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
process.exit(bad || (strict && warned) ? 1 : 0);
