// node spikes/band-plugin/bundle/core-candidates.ts — sizes of the modules that would stay in `svg-diagram/core` (alone, deps included), to bound its size.
import {bundle, kb} from './measure.ts';
const R = new URL('../../../lib/', import.meta.url).pathname;
const G: Record<string, string[]> = {
  'tokens + atoms + wrap + must': ['tokens', 'atoms', 'wrap', 'must'],
  'text layout (layout-text, layout-util)': ['layout-text', 'layout-util'],
  'emit helpers (emit-common, badge)': ['emit-common', 'badge'],
  'reveal + anchor scope + scope-name + source-ref': ['reveal', 'anchor-scope', 'scope-name', 'source-ref'],
  'connector routing (connect-rules, layout-route if any)': ['connect-rules'],
  'spotlight + focus': ['spotlight', 'focus'],
  'appearance (dark mode recolour)': ['appearance-auto'],
  'pipeline (stages shell)': ['pipeline'],
  'svg lint / xml check': ['svg-lint'],
};
for (const [name, files] of Object.entries(G)) {
  try { const b = await bundle(name.replace(/\W+/g, '-'), files.map(f => `export * from '${R}${f}.ts';`).join('\n').replace(/export \* from/g, (m, i) => m).split('\n').map((l, i) => l.replace('export * from', `export * as m${i} from`)).join('\n')); console.log(`${name.padEnd(56)} ${kb(b.bytes).padStart(9)}`); }
  catch (e) { console.log(`${name.padEnd(56)} ERR ${(e as Error).message.split('\n')[0]!.slice(0, 90)}`); }
}

// one bundle of the modules that stay in core as they are (no band tables): overlaps counted once
const U = ['tokens', 'atoms', 'wrap', 'must', 'layout-text', 'layout-util', 'emit-common', 'badge', 'scope-name', 'source-ref', 'connect-rules', 'layout-connect', 'route-search', 'route-apart', 'verify-base', 'appearance-auto', 'svg-lint', 'located'];
try { const b = await bundle('core-union', U.map((f, i) => `export * as m${i} from '${R}${f}.ts';`).join('\n')); console.log(`\ncore union (${U.length} modules, overlaps once): ${kb(b.bytes)} minified, ${kb(b.gz)} gzip`); } catch (e) { console.log('core union ERR', (e as Error).message.split('\n').slice(0, 3).join(' | ')); }
