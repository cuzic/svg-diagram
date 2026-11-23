// node spikes/band-plugin/run.ts — ADR 0080 spike (round 2): a plugin band next to core bands and inside containers, connect(), findings, the real
// sanitizer, dark mode, repeated layouts, a spec path, a missing plugin. Writes out/ok.svg and out/measurements.txt (no timings: reruns stay clean).
import fs from 'node:fs';
import {areas, box, caption, connect, diagram, group, row} from '../../lib/dsl-pure.ts';
import {renderDiagram} from '../../lib/dsl/render.ts';
import {captureSourceLocations, sourceOf} from '../../lib/source-ref.ts';
import {PluginNotSuppliedError, PluginRegistry, buildPluginPart, conformance, definePlugin, pluginBands, pluginBand, sanitizePluginSvg, withPluginFindings} from './host.ts';
import {ratingPlugin} from './rating-plugin.ts';

const out = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(out, {recursive: true});
const lines: string[] = []; const rep = (s: string): void => { lines.push(s); console.log(s); };
const R = {budget: 'cacheOnly'} as const;

const reg = new PluginRegistry([ratingPlugin]);
const rating = pluginBands(reg, ratingPlugin); // constructors built by the core from the plain-data plugin, wrapped in located()
const build = () => diagram({theme: 'blue', title: 'plugin band spike'}).add(
  caption('評価のまとめ'),
  box({id: 'item', title: '新しい画面'}),
  rating.stars({label: '使いやすさ', value: 4, max: 5}, {id: 'rate'}),
  box({id: 'note', title: '改善の余地あり', tone: 'accent'}),
  connect('item:bottom', 'rate:top'),
  connect('rate:bottom', 'note:top'),
);

// 1. beside core bands, connect(), determinism, hooks called several times
const a = await renderDiagram(build(), {name: 'p', ...R});
const callsOne = {...reg.calls};
const b = await renderDiagram(build(), {name: 'p', ...R});
rep(`beside core bands: verdict.ok=${a.verdict.ok}; plugin drawn=${a.svg.includes('data-node-host="plugin"')}; connectors=${(a.svg.match(/marker-end/g) ?? []).length}; byte-equal over 2 renders=${a.svg === b.svg}`);
captureSourceLocations(true);
const located1 = rating.stars({label: 'x', value: 1}, {id: 'q'});
captureSourceLocations(false);
rep(`constructor built by pluginBands() is located() (ADR 0072): source ref on the band = ${sourceOf(located1) !== undefined}`);
rep(`hook calls for 1 render (layout / emit): ${callsOne.layout} / ${callsOne.emit} (here raw() calls them at construction and draw only; the real core calls layout on every layout pass, so hooks must be idempotent: checked by conformance())`);
fs.writeFileSync(`${out}ok.svg`, a.svg);

// 2. the real sanitizer
const trials: [string, string][] = [
  ['text', '<text x="1" y="1">a</text>'], ['style', '<style>a{}</style>'], ['data-*', '<rect data-anchor="s1" x="0" y="0" width="1" height="1"/>'],
  ['rgb()', '<rect x="0" y="0" width="1" height="1" fill="rgb(1,2,3)"/>'], ['named colour', '<rect x="0" y="0" width="1" height="1" fill="red"/>'],
  ['image', '<image href="x.png"/>'], ['duplicate id', '<g id="fc"><circle id="fc" cx="1" cy="1" r="1"/></g>'], ['clean shapes', '<g><circle cx="1" cy="1" r="1" fill="#112233" stroke="#000000" stroke-width="1"/></g>'],
];
for (const [name, svg] of trials) { try { sanitizePluginSvg(svg, 'p', 'x-', false); rep(`sanitizer ${name}: accepted`); } catch (e) { rep(`sanitizer ${name}: rejected (${(e as Error).message.slice(0, 70)})`); } }

// 3. dark mode: a palette-token colour is recoloured; a fixed colour on `paper` is frozen (hex -> rgb() after the gate) and sits on a light backing
const dark = (paper: boolean) => renderDiagram(diagram({theme: 'blue', title: 'd', appearance: 'dark'}).add(rating.stars({label: 'x', value: 3, paper}, {id: 'r'})), {name: 'd', ...R});
const dTok = await dark(false), dPaper = await dark(true);
const light = await renderDiagram(diagram({theme: 'blue', title: 'd'}).add(rating.stars({label: 'x', value: 3}, {id: 'r'})), {name: 'd', ...R});
const fills = (s: string) => [...new Set([...s.matchAll(/data-node-host="plugin">[\s\S]*?<\/g><\/g>|data-node-host="plugin">[\s\S]*$/g)].flatMap(m => [...m[0].matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(x => x[1])))].join(' ');
rep(`dark mode, token colours: light=${fills(light.svg)} -> dark=${fills(dTok.svg)} (recoloured: ${fills(light.svg) !== fills(dTok.svg)})`);
rep(`dark mode, paper band: ${fills(dPaper.svg)} (no #hex left to recolour: ${!/#[0-9a-f]{6}/i.test(fills(dPaper.svg))})`);

// 4. containers: a plugin band as a child of group / row / areas (raw is the stand-in)
for (const [name, mk] of [
  ['group', () => group([rating.stars({label: 'x', value: 2}, {id: 'g1'})] as never, {})],
  ['row', () => row([box({id: 'ra', title: 'a'}), rating.stars({label: 'x', value: 2}, {id: 'r1'})] as never)],
  ['areas', () => areas('a b', {a: box({title: 'a'}), b: rating.stars({label: 'x', value: 2})} as never)],
] as const) {
  try {
    const r = await renderDiagram(diagram({theme: 'blue', title: name}).add(mk() as never), {name, ...R});
    rep(`container ${name}: drew=${r.svg.includes('data-node-host="plugin"')} verdict.ok=${r.verdict.ok} problems=${JSON.stringify(r.verdict.problems).slice(0, 90)}`);
  } catch (e) { rep(`container ${name}: throws (${(e as Error).message.slice(0, 100)})`); }
}

// 5. layouts that re-run the core's layout: canvas, width 'fit', fill-like narrow width; hooks stay idempotent (output equal for equal inputs)
for (const [name, opts] of [['canvas', {canvas: 'slide'}], ['width fit', {width: 'fit'}], ['narrow 360', {width: 360}]] as const) {
  try {
    reg.calls.layout = reg.calls.emit = 0;
    const r = await renderDiagram(diagram({theme: 'blue', title: name, ...opts} as never).add(rating.stars({label: 'x', value: 3}, {id: 'r'})), {name, ...R});
    const r2 = await renderDiagram(diagram({theme: 'blue', title: name, ...opts} as never).add(rating.stars({label: 'x', value: 3}, {id: 'r'})), {name, ...R});
    rep(`layout variant ${name}: ok=${r.verdict.ok} equal across runs=${r.svg.replace(/p\d+-/g, '') === r2.svg.replace(/p\d+-/g, '')} plugin layout calls=${reg.calls.layout} (raw does not re-run it per core pass: that is only proven by conformance() idempotence)`);
  } catch (e) { rep(`layout variant ${name}: throws (${(e as Error).message.slice(0, 100)})`); }
}

// 6. findings (merged), constructor error, not supplied, spec, API version, sub-anchor
const bad = diagram({theme: 'blue', title: 'bad', width: 300}).add(rating.stars({label: '品質', value: 7, max: 5}, {id: 'r2'}));
const rb = await renderDiagram(bad, {name: 'bad', ...R});
const merged = withPluginFindings(reg, rb.laidOut, rb.verdict);
rep(`findings: core verdict alone ok=${rb.verdict.ok}; merged ok=${merged.ok} problems=${JSON.stringify(merged.problems)} findings=${JSON.stringify(merged.findings.map(f => `${f.rule}:${f.severity}`))}`);
try { rating.stars({label: '', value: 1}); } catch (e) { rep(`bad data -> ${(e as Error).message}`); }
try { buildPluginPart(new PluginRegistry([]), {type: 'rating-demo:stars', label: 'x', value: 1}); } catch (e) { rep(`not supplied -> ${e instanceof PluginNotSuppliedError}: ${(e as Error).message}`); }
try { new PluginRegistry([definePlugin({id: 'rating-demo', apiVersion: '0.2', bands: {}})]); } catch (e) { rep(`api 0.2 on host 0.1 -> ${(e as Error).message.slice(0, 80)}`); }
rep(`spec part -> ${buildPluginPart(reg, {type: 'rating-demo:stars', label: '速さ', value: 3, id: 'rate3'}).type} (the host lowers it to raw)`);
rep(`conformance(ratingPlugin) failures: ${JSON.stringify(conformance(ratingPlugin))}`);
try {
  await renderDiagram(diagram({theme: 'blue', title: 't'}).add(box({id: 'a', title: 'a'}), pluginBand(reg, 'rating-demo:stars', {label: 'x', value: 1}, {id: 'rate'}), connect('a:bottom', 'rate.s2:top') as never), {name: 'x', ...R});
  rep('connect to a star: resolved');
} catch (e) { rep(`connect to a star -> ${(e as Error).message.slice(0, 100)} (raw registers no anchors: a layout hook is needed)`); }
fs.writeFileSync(`${out}measurements.txt`, lines.join('\n') + '\n');
