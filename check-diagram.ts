#!/usr/bin/env node
// svg-diagram check — rules, drift and document checks (nothing is written to the diagrams).
//
//   svg-diagram check [--strict] [--verbose] <source.ts>...
//       Lay the diagram out and run the rules (lib/rules.ts): WCAG contrast, legend, lane order,
//       edge crossings, width, density, wireframe callouts and state matrices ... Exit 1 on a layout error,
//       or on any warning with --strict.
//   svg-diagram check --drift [--svg-dir DIR] [--rebuild] <source.ts>...
//       Compare each source's SHA-256 with the one embedded in the committed SVG (<metadata id="svg-diagram">),
//       so an SVG that was not regenerated after its source — or a local file it imports — changed is caught. DIR defaults to ./svg.
//       --rebuild also regenerates each SVG in memory and compares the bytes; a difference is explained
//       (metadata only? text moved? shapes added?), so you can tell whether regenerating is safe.
//   svg-diagram check --docs PATH... [--only GLOB]... [--svg-dir DIR] [--src-dir DIR]
//       Do the Markdown pages and the diagrams still agree? PATH is a directory (searched for .md) or one .md file; repeat --docs for several.
//       Referenced SVGs exist, alt text is short and present, figure captions 図N-M are in order, 図N-M in the text names a real figure,
//       no SVG is left unreferenced (--svg-dir), and the numbered notes under a figure match the figure's own notes (--src-dir).
//       --only GLOB (repeatable, e.g. 'docs/03-*.md') keeps just the matching pages. Whenever the pages are narrowed (a .md file or --only),
//       the orphan-SVG check is skipped (it needs every page to know what is unreferenced) and a note says so.
//       --map prints the figure <-> document table (Markdown) on stdout instead; the findings go to stderr.
//   svg-diagram check --covers TABLE.md|TABLE.csv [--svg-dir DIR] <source.ts|file.svg>...
//       Does the figure that replaces a table still carry the table's cells? Each cell is looked up in the figure's <text>
//       (width, case, spaces and punctuation ignored); a cell that is not there whole is judged by its proper-noun and number tokens,
//       and the missing ones are listed. A source is read through its committed SVG (DIR defaults to ./svg).
//   Any mode:  --format text|json|github   (github = ::warning annotations for a pull request)
//   Project settings (accepted rules, max width) come from .svg-diagram.json, found by walking up from the current directory.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {DiagramSource} from './lib/types/core.ts';
import type {MapRow} from './lib/docs-check.ts';
import {register} from 'node:module';
// Run from source (.ts) or from the compiled dist/ (.js); sibling files share the extension.
const EXT = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
register(`./lib/resolve-hook.${EXT}`, import.meta.url);
const {checkDiagram, build, closeMeasurer} = await import('./lib/dsl.ts');
const {depsSha256} = await import('./lib/source-deps.ts');
const {RULE_DOCS} = await import('./lib/rules.ts');
const {scanPngRefs, scanMarkdown, compareNotes, notesOf, formatMap, checkFigures, chapterOf, globToRegExp, matchesAny} = await import('./lib/docs-check.ts');
const {explainChange} = await import('./lib/svg-diff.ts');
const {loadConfig} = await import('./lib/config.ts');
const {loadDiagram} = await import('./lib/load-source.ts');
const {readTable, figureText, checkCovers} = await import('./lib/covers.ts');

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const val = (n: string) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const VALUE_FLAGS = ['--svg-dir', '--src-dir', '--docs', '--covers', '--format', '--only'];
const vals = (n: string) => args.flatMap((a, i) => (a === n && args[i + 1] !== undefined ? [args[i + 1]] : []));
// --docs takes the path after it, and every following .md file / directory too (`--docs A.md B.md dir`): those are documents, never sources
const isDocArg = (a: string) => !a.startsWith('--') && (a.toLowerCase().endsWith('.md') || (fs.existsSync(a) && fs.statSync(a).isDirectory()));
const docsArgIdx = new Set<number>();
args.forEach((a, i) => { if (a === '--docs') for (let j = i + 1; j < args.length && (j === i + 1 ? args[j] !== undefined && !args[j].startsWith('--') : isDocArg(args[j])); j++) docsArgIdx.add(j); });
const strict = flag('--strict'), verbose = flag('--verbose'), drift = flag('--drift'), rebuild = flag('--rebuild');
const mapMode = flag('--map');
if (mapMode && (!val('--docs') || (val('--format') ?? 'text') !== 'text')) { console.error('--map は --docs と一緒に、--format text で使う（表を標準出力に出す）'); process.exit(2); }
const svgDir = val('--svg-dir'), srcDir = val('--src-dir'), docsDirs = args.filter((_, i) => docsArgIdx.has(i)), docsDir = docsDirs[0], coversFile = val('--covers'), only = vals('--only').map(globToRegExp), format = val('--format') ?? 'text';
const sources = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]) && !docsArgIdx.has(i));
for (const s of sources) {
  const ok = coversFile && s.toLowerCase().endsWith('.svg') ? true : /\.(ts|mts|cts|js|mjs|cjs)$/i.test(s);
  if (!ok) { console.error(`✗ ${s}: 図のソース（.ts / .mjs）ではない。${/\.md$/i.test(s) ? '文書は --docs ' + s + ' で渡す' : '図のソースを指定する'}`); process.exit(2); }
}
if (!['text', 'json', 'github'].includes(format)) { console.error(`--format must be text, json or github (got "${format}")`); process.exit(2); }
if (!sources.length && !docsDir) { console.error('Usage: svg-diagram check [--strict] [--verbose] [--drift [--svg-dir DIR] [--rebuild]] [--docs PATH... [--only GLOB]... [--svg-dir DIR] [--src-dir DIR] [--map]] [--covers TABLE.md|TABLE.csv [--svg-dir DIR]] [--format text|json|github] <source.ts>...'); process.exit(2); }
const config = loadConfig();
let coverCells: ReturnType<typeof readTable> = [];
if (coversFile) {
  if (!fs.existsSync(coversFile)) { console.error(`--covers: ${coversFile} がない`); process.exit(2); }
  coverCells = readTable(fs.readFileSync(coversFile, 'utf8'), coversFile.toLowerCase().endsWith('.csv') ? 'csv' : 'md');
  if (!coverCells.length) { console.error(`--covers: ${coversFile} に表がない（Markdown は見出し行と |---| の行が要る）`); process.exit(2); }
}

const say = (...a: unknown[]) => { if (format === 'text') (mapMode ? console.error : console.log)(...a); };
const complain = (...a: unknown[]) => { if (format === 'text') console.error(...a); };
type CheckFinding = {file: string; line?: number; rule: string; severity: 'error' | 'warn' | 'info'; message: string};
const findings: CheckFinding[] = [];
let bad = 0, warned = 0;
const add = (f: CheckFinding) => { findings.push(f); if (f.severity === 'error') bad++; else if (f.severity === 'warn') warned++; };

const sha = (f: string) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function embedded(svgPath: string): DiagramSource | null {
  const m = fs.readFileSync(svgPath, 'utf8').match(/<metadata id="svg-diagram">([^<]*)<\/metadata>/);
  if (!m) return null;
  try { return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); } catch { return null; }
}
function walkMd(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['html', 'node_modules', '.git'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(f, out); else if (e.name.endsWith('.md')) out.push(f);
  }
  return out;
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
        const alt = fig.alt.trim();
        if (!alt) add({file: rel, line: fig.line, rule: 'doc-alt-empty', severity: 'warn', message: `${name}: 代替テキストが空`});
        else if ([...alt].length > 155) add({file: rel, line: fig.line, rule: 'doc-alt-long', severity: 'warn', message: `${name}: 代替テキストが ${[...alt].length} 文字（155 文字以内にして、詳しい説明は本文に）`});
        const srcFile = srcDir && ['.ts', '.mjs'].map(ext => path.join(srcDir, name + ext)).find(f => fs.existsSync(f));
        mapRows.push({name, svg: path.relative(process.cwd(), abs), doc: where, src: srcFile ? path.relative(process.cwd(), srcFile) : ''});
        if (srcFile) {
          const d = await loadDiagram(path.resolve(srcFile), config);
          const sets = notesOf(d.bands);
          if (sets.length === 1) for (const f of compareNotes(fig.items, sets[0], name)) add({file: rel, line: fig.line, ...f});
          else if (sets.length > 1) add({file: rel, line: fig.line, rule: 'doc-notes-mismatch', severity: 'info', message: `${name}: 注釈つきのワイヤーフレームが ${sets.length} 枚あり、突き合わせない`});
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
  for (const src of sources) {
    const abs = path.resolve(src);
    const name = path.parse(src).name;
    if (coversFile) {
      const svg = src.endsWith('.svg') ? src : path.join(svgDir ?? 'svg', `${name}.svg`);
      if (!fs.existsSync(svg)) { add({file: src, rule: 'covers-missing-svg', severity: 'error', message: `${svg} がない（未生成）`}); complain(`✗ ${src}: ${svg} がない（未生成）`); continue; }
      const cells = coverCells;
      const lost = checkCovers(cells, figureText(fs.readFileSync(svg, 'utf8')));
      for (const u of lost) add({file: coversFile, line: u.cell.line, rule: 'covers-missing', severity: 'warn', message: `${name}: 「${u.cell.text}」が図にない（欠けた語: ${u.missing.join('、')}）`});
      say(`${lost.length ? '△' : '✓'} ${src}: 表のセル ${cells.length} 件中 ${lost.length} 件が図にない`);
      for (const u of lost) say(`   ⚠ ${coversFile}:${u.cell.line} [covers-missing] 「${u.cell.text}」（欠けた語: ${u.missing.join('、')}）`);
      continue;
    }
    if (drift) {
      const svg = path.join(svgDir ?? 'svg', `${name}.svg`);
      if (!fs.existsSync(svg)) { add({file: src, rule: 'drift-missing', severity: 'error', message: `${svg} がない（未生成）`}); complain(`✗ ${src}: ${svg} がない（未生成）`); continue; }
      const meta = embedded(svg);
      if (!meta) { add({file: src, rule: 'drift-no-provenance', severity: 'error', message: `${svg} に生成元の情報がない。再生成する`}); complain(`✗ ${src}: ${svg} に生成元の情報（<metadata id="svg-diagram">）がない。再生成する`); continue; }
      if (meta.sourceSha256 !== sha(abs)) { add({file: src, rule: 'drift-stale', severity: 'error', message: `ソースが変わっているのに ${svg} が再生成されていない`}); complain(`✗ ${src}: ソースが変わっているのに ${svg} が再生成されていない`); continue; }
      if ((meta.depsSha256 ?? '') !== depsSha256(abs)) { add({file: src, rule: 'drift-stale-deps', severity: 'error', message: `ソースが import しているファイル（共通部品など）が変わっているのに ${svg} が再生成されていない`}); complain(`✗ ${src}: import しているファイル（共通部品など）が変わっているのに ${svg} が再生成されていない`); continue; }
      if (rebuild) {
        const d = await loadDiagram(abs, config);
        d.source = meta; // same provenance → byte-comparable
        const tmp = path.join(path.dirname(svg), `.${name}.rebuild.svg`);
        let rebuilt: Awaited<ReturnType<typeof build>>;
        try { rebuilt = await build(d, tmp, {lint: false, name: `${name}.svg`}); } // the committed SVG was linted when it was built; an identical rebuild needs no second render
        catch (e) { // the regenerated picture fails its own checks: report it and go on with the rest
          fs.rmSync(tmp, {force: true});
          const why = String((e as Error).message).split('\n').filter(l => l.trim() && !/^Scanned|^─/.test(l)).slice(0, 3).join(' / ');
          add({file: src, rule: 'drift-rebuild-failed', severity: 'error', message: `再生成した SVG が自分の検査に通らない: ${why}`});
          complain(`✗ ${src}: 再生成した SVG が自分の検査に通らない: ${why}`);
          continue;
        }
        const pairs = [[svg, tmp], ...rebuilt.revealPaths.map((p, stage) => [path.join(path.dirname(svg), `${name}.reveal${stage}.svg`), p])];
        const orphaned = fs.readdirSync(path.dirname(svg)).filter(f => {
          const m = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.reveal(\\d+)\\.svg$`).exec(f);
          return m && Number(m[1]) >= rebuilt.revealPaths.length;
        });
        const changed = pairs.find(([beforePath, afterPath]) => !fs.existsSync(beforePath) || fs.readFileSync(beforePath, 'utf8') !== fs.readFileSync(afterPath, 'utf8'));
        if (orphaned.length) {
          for (const [, p] of pairs) fs.rmSync(p, {force: true});
          add({file: src, rule: 'drift-orphan-reveal', severity: 'error', message: `古い reveal ファイルが残っている: ${orphaned.join(', ')}`});
          complain(`✗ ${src}: 古い reveal ファイルが残っている: ${orphaned.join(', ')}`);
          continue;
        }
        if (changed) {
          const [beforePath, afterPath] = changed;
          if (!fs.existsSync(beforePath)) {
            for (const [, p] of pairs) fs.rmSync(p, {force: true});
            add({file: src, rule: 'drift-missing', severity: 'error', message: `${beforePath} がない（未生成）`});
            complain(`✗ ${src}: ${beforePath} がない（未生成）`);
            continue;
          }
          const before = fs.readFileSync(beforePath, 'utf8'), after = fs.readFileSync(afterPath, 'utf8');
          for (const [, p] of pairs) fs.rmSync(p, {force: true});
          const ex = explainChange(before, after);
          add({file: src, rule: 'drift-rebuild', severity: 'error', message: `再生成した SVG が ${beforePath} と一致しない（ツールの版が違う、または手で編集された）。${ex.lines.join(' / ')}`});
          complain(`✗ ${src}: 再生成した SVG が ${beforePath} と一致しない（ツールの版が違う、または手で編集された）`);
          for (const l of ex.lines) complain(`     ↳ ${l}`);
          complain(`     ↳ ${ex.visual ? '見た目が変わる。再生成して、目で確かめる' : '見た目は変わらない。再生成してよい'}`);
          continue;
        }
        for (const [, p] of pairs) fs.rmSync(p, {force: true});
      }
      say(`✓ ${src}: ${svg} は最新（ツール ${meta.toolVersion}）`);
      continue;
    }
    const d = await loadDiagram(abs, config);
    const {verdict} = await checkDiagram(d);
    if (!verdict.ok) { for (const p of verdict.problems) add({file: src, rule: 'layout', severity: 'error', message: p}); complain(`✗ ${src}:\n  ${verdict.problems.join('\n  ')}`); continue; }
    for (const f of verdict.findings) add({file: src, rule: f.rule, severity: f.severity, message: f.message});
    const w = verdict.findings.filter(f => f.severity === 'warn').length;
    say(`${w ? '△' : '✓'} ${src}${w ? `（警告 ${w}）` : ''}`);
    for (const f of verdict.findings.filter(f => verbose || f.severity === 'warn')) say(`   ${f.severity === 'warn' ? '⚠' : 'ℹ'} [${f.rule}] ${f.message}`);
  }
} finally {
  await closeMeasurer();
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
