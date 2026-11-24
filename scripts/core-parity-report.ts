// Usage: node scripts/core-parity-report.ts [--out FILE] [examples/NAME.ts ...]
import {globSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {detachData} from '../lib/dsl/diagram.ts';
import {resolveImages} from '../lib/image-file.ts';
import {renderLegacyDiagramWithCore, unsupportedCoreOptions} from '../lib/legacy-core.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {walkBands} from '../lib/rules.ts';
import type {DiagramData, MeasureRequest} from '../lib/types/core.ts';
import {renderInBrowser} from '../lib/web.ts';
import type {WebRender} from '../lib/web.ts';

type Drawing = Pick<WebRender, 'svg' | 'width' | 'height' | 'verdict'>;
type Attempt<T extends Drawing = Drawing> = {drawing: T} | {error: string};
type Difference = {legacyOnly: string[]; coreOnly: string[]};
interface Comparison {
  sameSvg: boolean;
  width: number;
  height: number;
  problems: Difference;
  warnings: Difference;
  rules: Difference;
}
interface Example {
  name: string;
  legacy: Attempt;
  core: Attempt;
  unsupported: string[];
  comparison?: Comparison;
}

const measure = ({text, size}: MeasureRequest) => ({w: [...text].length * size * 0.6, h: size});
const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split(/\r\n?|\n/, 1)[0] ?? '';

async function draw<T extends Drawing>(render: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return {drawing: await render()};
  } catch (error) {
    return {error: `描画失敗 — ${firstLine(error)}`};
  }
}

function difference(legacy: readonly string[], core: readonly string[]): Difference {
  const legacySet = new Set(legacy), coreSet = new Set(core);
  return {
    legacyOnly: [...legacySet].filter(item => !coreSet.has(item)).sort(),
    coreOnly: [...coreSet].filter(item => !legacySet.has(item)).sort(),
  };
}

function compare(legacy: Drawing, core: Drawing): Comparison {
  return {
    sameSvg: legacy.svg === core.svg,
    width: core.width - legacy.width,
    height: core.height - legacy.height,
    problems: difference(legacy.verdict.problems, core.verdict.problems),
    warnings: difference(legacy.verdict.warnings, core.verdict.warnings),
    rules: difference(legacy.verdict.findings.map(f => f.rule), core.verdict.findings.map(f => f.rule)),
  };
}

async function compareExample(file: string): Promise<Example> {
  const name = path.basename(file);
  let diagram: DiagramData;
  try {
    diagram = detachData(await loadDiagram(file));
  } catch (error) {
    const failure = {error: `読込失敗 — ${firstLine(error)}`};
    return {name, legacy: failure, core: failure, unsupported: []};
  }
  try {
    resolveImages(walkBands(diagram.bands), diagram.sourceDir ?? path.dirname(file));
  } catch (error) {
    const failure = {error: `画像読込失敗 — ${firstLine(error)}`};
    return {name, legacy: failure, core: failure, unsupported: unsupportedCoreOptions(diagram)};
  }
  const legacy = await draw(() => renderInBrowser(diagram, {measure}));
  const core = await draw(() => renderLegacyDiagramWithCore(diagram, {measure}));
  const unsupported = 'drawing' in core ? core.drawing.unsupported : unsupportedCoreOptions(diagram);
  const comparison = 'drawing' in legacy && 'drawing' in core ? compare(legacy.drawing, core.drawing) : undefined;
  return {name, legacy, core, unsupported, comparison};
}

const cell = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('|', '&#124;').replace(/\r\n?|\n/g, ' ');
const outcome = (attempt: Attempt): string => 'drawing' in attempt ? '描画可' : cell(attempt.error);
const changed = (diff: Difference): boolean => diff.legacyOnly.length > 0 || diff.coreOnly.length > 0;
const signed = (n: number): string => n > 0 ? `+${n}` : String(n);

function diffCell(diff: Difference): string {
  const parts = [
    ...diff.legacyOnly.map(item => `従来のみ — ${cell(item)}`),
    ...diff.coreOnly.map(item => `帯の定義のみ — ${cell(item)}`),
  ];
  return parts.join('<br>') || '—';
}

function markdown(examples: readonly Example[]): string {
  const comparisons = examples.flatMap(row => row.comparison ? [row.comparison] : []);
  const sameVerdict = (c: Comparison): boolean => ![c.problems, c.warnings, c.rules].some(changed);
  const sameSize = (c: Comparison): boolean => c.width === 0 && c.height === 0;
  const counts = [
    ['同一', comparisons.filter(c => c.sameSvg && sameSize(c) && sameVerdict(c)).length],
    ['寸法だけ違う', comparisons.filter(c => !sameSize(c) && sameVerdict(c)).length],
    ['問題が増えた', comparisons.filter(c => c.problems.coreOnly.length > 0).length],
    ['問題が減った', comparisons.filter(c => c.problems.legacyOnly.length > 0).length],
    ['描けない', examples.length - comparisons.length],
    ['未対応の設定あり', examples.filter(row => row.unsupported.length > 0).length],
  ];
  const rows = examples.map(({name, legacy, core, unsupported, comparison: c}) => {
    const deltas = c ? [
      c.sameSvg ? '同一' : '差あり', signed(c.width), signed(c.height),
      diffCell(c.problems), diffCell(c.warnings), diffCell(c.rules),
    ] : ['—', '—', '—', '—', '—', '—'];
    return `| ${[cell(name), outcome(legacy), outcome(core), unsupported.map(cell).join(', ') || '—', ...deltas].join(' | ')} |`;
  });
  return [
    '# 従来と帯の定義による描画の比較', '', `作例数 ${examples.length}`, '',
    ...counts.map(([label, count]) => `- ${label} ${count}`),
    '', '「寸法だけ違う」は寸法に差があり、問題・警告・所見の規則 ID に差がない作例を数える。寸法差は帯の定義による描画から従来の値を引いた値（px）。',
    '問題の増減は各経路だけにあるメッセージを数え、同じ作例が両方の件数に入ることがある。', '',
    '| 作例 | 従来 | 帯の定義 | 未対応の設定 | SVG | 幅の差 | 高さの差 | 問題の差 | 警告の差 | 所見の規則 ID の差 |',
    '| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |',
    ...rows, '',
  ].join('\n');
}

const {values: {out}, positionals} = parseArgs({options: {out: {type: 'string'}}, allowPositionals: true});
const root = path.resolve(import.meta.dirname, '..');
const examples = positionals.length ? positionals.map(file => path.resolve(file))
  : globSync('examples/*.ts', {cwd: root}).sort().map(file => path.join(root, file));

installResolveHook();
const rows: Example[] = [];
for (const file of examples) rows.push(await compareExample(file));
const report = markdown(rows);
if (out === undefined) process.stdout.write(report);
else writeFileSync(out, report);
