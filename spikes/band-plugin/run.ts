// node spikes/band-plugin/run.ts — ADR 0080 spike: a plugin band next to core bands, a connect() to it, findings, a spec path, a missing plugin.
import fs from 'node:fs';
import {box, caption, connect, diagram} from '../../lib/dsl-pure.ts';
import {renderDiagram} from '../../lib/dsl/render.ts';
import {PluginNotSuppliedError, PluginRegistry, buildPluginPart, pluginBand, withPluginFindings} from './host.ts';
import {ratingPlugin} from './rating-plugin.ts';

const out = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(out, {recursive: true});
const lines: string[] = []; const rep = (s: string): void => { lines.push(s); console.log(s); };

const reg = new PluginRegistry([ratingPlugin]);
const build = () => diagram({theme: 'blue', title: 'plugin band spike'}).add(
  caption('評価のまとめ'),
  box({id: 'item', title: '新しい画面'}),
  pluginBand(reg, 'rating-demo:stars', {label: '使いやすさ', value: 4, max: 5}, {id: 'rate'}),
  box({id: 'note', title: '改善の余地あり', tone: 'accent'}),
  connect('item:bottom', 'rate:top'),
  connect('rate:bottom', 'note:top'),
);

const t0 = performance.now();
const a = await renderDiagram(build(), {name: 'plugin-spike', budget: 'cacheOnly'});
const b = await renderDiagram(build(), {name: 'plugin-spike', budget: 'cacheOnly'});
rep(`render: ${(performance.now() - t0).toFixed(0)} ms for 2 renders; deterministic (byte-equal svg): ${a.svg === b.svg}`);
rep(`core verdict: ok=${a.verdict.ok} problems=${JSON.stringify(a.verdict.problems)}`);
rep(`plugin band drawn: ${a.svg.includes('data-plugin="rating-demo:stars"')}; connectors drawn: ${(a.svg.match(/marker-end/g) ?? []).length}`);
const anchorRate = a.laidOut.laidOut.find(x => x.type === 'raw');
rep(`connect() to the plugin band id resolved (no throw, band at y=${anchorRate?.y}, h=${anchorRate?.h}); connect to a star ('rate.s2') is not possible with raw (anchors are not registered)`);
fs.writeFileSync(`${out}ok.svg`, a.svg);

// findings: value over max, and a stars row wider than the band
const bad = diagram({theme: 'blue', title: 'bad', width: 300}).add(pluginBand(reg, 'rating-demo:stars', {label: '品質', value: 7, max: 5}, {id: 'r2'}));
const r = await renderDiagram(bad, {name: 'plugin-spike-bad', budget: 'cacheOnly'});
const merged = withPluginFindings(reg, r.laidOut, r.verdict);
rep(`core verdict alone: ok=${r.verdict.ok}; merged with the plugin's: ok=${merged.ok} problems=${JSON.stringify(merged.problems)} findings=${JSON.stringify(merged.findings.map(f => f.rule))}`);

// a constructor error names the plugin
try { pluginBand(reg, 'rating-demo:stars', {label: '', value: 1}); } catch (e) { rep(`bad data -> ${(e as Error).message}`); }
// the plugin is not supplied
try { buildPluginPart(new PluginRegistry([]), {type: 'rating-demo:stars', label: 'x', value: 1}); } catch (e) { rep(`not supplied -> ${e instanceof PluginNotSuppliedError}: ${(e as Error).message}`); }
// a spec path
const fromSpec = buildPluginPart(reg, {type: 'rating-demo:stars', label: '速さ', value: 3, id: 'rate3'});
rep(`spec part -> band type ${fromSpec.type}, id ${fromSpec.id}`);
fs.writeFileSync(`${out}measurements.txt`, lines.join('\n') + '\n');

// a connect() to a part of the plugin band (a star): raw registers no anchors, so layout throws; a real hook must register `anchors`
try {
  await renderDiagram(diagram({theme: 'blue', title: 't'}).add(box({id: 'a', title: 'a'}), pluginBand(reg, 'rating-demo:stars', {label: 'x', value: 1}, {id: 'rate'}), connect('a:bottom', 'rate.s2:top') as never), {name: 'x', budget: 'cacheOnly'});
  rep('connect to a star: resolved');
} catch (e) { rep(`connect to a star -> ${(e as Error).message.slice(0, 110)}`); }
fs.writeFileSync(`${out}measurements.txt`, lines.join('\n') + '\n');
