#!/usr/bin/env node
// svg-diagram check — rules and drift checks for diagram sources (nothing is written).
//
//   svg-diagram check [--strict] [--verbose] <source.mjs>...
//       Lay the diagram out and run the rules (lib/rules.mjs): WCAG contrast, legend, lane order,
//       edge crossings, width, density, ... Exit 1 on a layout error, or on any warning with --strict.
//   svg-diagram check --drift [--svg-dir DIR] <source.mjs>...
//       Compare each source's SHA-256 with the one embedded in the committed SVG (<metadata id="svg-diagram">),
//       so an SVG that was not regenerated after its source changed is caught. DIR defaults to ./svg.
//       Add --rebuild to also regenerate each SVG in memory and compare the bytes.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {register} from 'node:module';
register('./lib/resolve-hook.mjs', import.meta.url);
const {checkDiagram, build, closeMeasurer} = await import('./lib/dsl.mjs');
const {RULE_DOCS} = await import('./lib/rules.mjs');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const strict = flag('--strict'), verbose = flag('--verbose'), drift = flag('--drift'), rebuild = flag('--rebuild');
const svgDir = val('--svg-dir') ?? 'svg';
const sources = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--svg-dir');
if (!sources.length) { console.error('Usage: svg-diagram check [--strict] [--verbose] [--drift [--svg-dir DIR] [--rebuild]] <source.mjs>...'); process.exit(2); }

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
let bad = 0, warned = 0;

function embedded(svgPath) {
  const m = fs.readFileSync(svgPath, 'utf8').match(/<metadata id="svg-diagram">([^<]*)<\/metadata>/);
  if (!m) return null;
  try { return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); } catch { return null; }
}

try {
  for (const src of sources) {
    const abs = path.resolve(src);
    const name = path.basename(src, '.mjs');
    if (drift) {
      const svg = path.join(svgDir, `${name}.svg`);
      if (!fs.existsSync(svg)) { console.error(`✗ ${src}: ${svg} がない（未生成）`); bad++; continue; }
      const meta = embedded(svg);
      if (!meta) { console.error(`✗ ${src}: ${svg} に生成元の情報（<metadata id="svg-diagram">）がない。再生成する`); bad++; continue; }
      if (meta.sourceSha256 !== sha(abs)) { console.error(`✗ ${src}: ソースが変わっているのに ${svg} が再生成されていない`); bad++; continue; }
      if (rebuild) {
        const mod = await import(abs);
        const d = mod.default();
        d.source = meta; // same provenance → byte-comparable
        const tmp = path.join(path.dirname(svg), `.${name}.rebuild.svg`);
        await build(d, tmp);
        const same = fs.readFileSync(tmp, 'utf8') === fs.readFileSync(svg, 'utf8');
        fs.rmSync(tmp, {force: true});
        if (!same) { console.error(`✗ ${src}: 再生成した SVG が ${svg} と一致しない（ツールの版が違う、または手で編集された）`); bad++; continue; }
      }
      console.log(`✓ ${src}: ${svg} は最新（ツール ${meta.toolVersion}）`);
      continue;
    }
    const mod = await import(abs);
    const d = mod.default();
    const {verdict} = await checkDiagram(d);
    if (!verdict.ok) { console.error(`✗ ${src}:\n  ${verdict.problems.join('\n  ')}`); bad++; continue; }
    const shown = verdict.findings.filter(f => verbose || f.severity === 'warn');
    const w = verdict.findings.filter(f => f.severity === 'warn').length;
    warned += w;
    console.log(`${w ? '△' : '✓'} ${src}${w ? `（警告 ${w}）` : ''}`);
    for (const f of shown) console.log(`   ${f.severity === 'warn' ? '⚠' : 'ℹ'} [${f.rule}] ${f.message}`);
  }
} finally {
  await closeMeasurer();
}
if (verbose && !drift) console.log('\nルール:\n' + Object.entries(RULE_DOCS).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
process.exit(bad || (strict && warned) ? 1 : 0);
