import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build as esbuild} from 'esbuild';

type Budget = {esbuild: number; Vite: number};
type ExportTarget = string | {default?: string; node?: string; types?: string};
type JsChunk = {fileName: string; code: string};
class ExportClassificationError extends Error {}

function importedEntries(source: string): string[] {
  return [...source.matchAll(/\bfrom ['"]svg-diagram(\/[^'"]+)?['"]/g)].map(([, subpath]) => '.' + (subpath ?? ''));
}

function reviewSvg(svg: string, label: string): void {
  assert.match(svg, /<svg\b[\s\S]*<text[^>]*>Review<\/text>/, label);
}

function reviewDrawing(result: {svg: string; verdict: {ok: boolean}; xml: string[]}, label: string): void {
  assert.equal(result.verdict.ok, true, label);
  assert.deepEqual(result.xml, [], label);
  reviewSvg(result.svg, label);
}

function reviewHtml(html: string, label: string): void {
  assert.match(html, /class="sd-b"[\s\S]*>Review<\/div>/, label);
  assert.doesNotMatch(html, /<svg\b/, label);
}

function zipHeader(zip: Uint8Array, label: string): void {
  assert.deepEqual([...zip.subarray(0, 4)], [0x50, 0x4b, 3, 4], label);
}

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
// Use the same Vite version as the docs build.
const viteRequire = createRequire(require.resolve('vitepress/package.json'));
const viteRoot = path.dirname(viteRequire.resolve('vite/package.json'));
const {build: viteBuild} = await import(pathToFileURL(path.join(viteRoot, 'dist/node/index.js')).href);

const consumer = mkdtempSync(path.join(tmpdir(), 'svg-diagram-consumer-'));
try {
  mkdirSync(path.join(consumer, 'node_modules'));
  symlinkSync(root, path.join(consumer, 'node_modules/svg-diagram'), 'junction');
  const entry = path.join(consumer, 'entry.js');
  const bandSource = (name: 'box' | 'gantt') => `
    import {renderBands} from 'svg-diagram/core';
    import {${name}} from 'svg-diagram/bands/${name}';
    export const draw = () => renderBands([${name === 'box'
      ? "box({title: 'Review', size: 18})"
      : "gantt([{section: '第一段階'}, {id: 'review', label: 'Review', start: '2026-11-23', days: 3, progress: 0.5}, {label: '公開', start: '2026-11-27', milestone: true, after: 'review'}], {today: 'auto', todayLabel: '基準日'})"}], {
      ${name === 'gantt' ? "today: '2026-11-24'," : ''}
      measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
    });
  `;
  const composedSource = (components: string[], bands: string, extraImports = '') => `
    import {renderBands} from 'svg-diagram/core';
    ${components.map(name => `import {${name}} from 'svg-diagram/bands/${name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}';`).join('\n')}
    ${extraImports}
    export const draw = () => renderBands([${bands}], {
      measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
    });
  `;
  const fullRenderer = ['web.js', 'layout-handlers.js', 'verify-handlers.js', 'emit-handlers.js', 'fit-handlers.js', 'rules.js', 'inventory.js', 'math-tex.js', 'spotlight.js', 'full-definitions.js'];
  const legacy = [...fullRenderer, 'spotlight-core.js', 'slide-fill.js'];
  const otherSpotlightBands = ['emit-spotlight-chart.js', 'emit-bars.js', 'emit-flow-shape.js', 'emit-image.js'];
  const flowSamples = [
    ['chevron', 'layoutChevron', "chevron([{label: 'Review'}, {label: 'Release'}])"],
    ['funnel', 'layoutFunnel', "funnel([{label: 'Review', value: 1}, {label: 'Release', value: 2}], {scale: 'value'})"],
    ['cycle', 'layoutCycleShape', "cycle([{label: 'Review'}, {label: 'Revise'}, {label: 'Release'}])"],
    ['venn', 'layoutVenn', "venn([{name: 'Review'}, {name: 'Release'}])"],
    ['concentric', 'layoutConcentricShape', "concentric([{label: 'Review'}, {label: 'Release'}])"],
    ['emblem', 'layoutEmblem', "emblem('Review')"],
    ['valueChain', 'layoutValueChain', "valueChain({primary: ['Review', 'Release']})"],
  ] as const;
  const quantitySamples = [
    ['people', 'layoutPeople', "people(10, 7, {side: {value: 'Review'}})"],
    ['dots', 'layoutDots', "dots([0.2, 0.2, 0.8], {lowLabel: 'Review'})"],
  ] as const;
  const tableSamples = [
    ['sequence', 'layoutSequence', "sequence([{id: 'a', label: 'Review'}, {id: 'b', label: 'API'}], [{from: 'a', to: 'b', label: 'Send'}])"],
    ['table', 'layoutTable', "table([{label: 'Review'}, {label: 'Value', mono: true}], [['Name', 'ABC']])"],
  ] as const;
  const screenSamples = [
    ['wireframe', 'layoutWireframe', "wireframe(wf.col([wf.region('Review')]))"],
    ['screens', 'layoutScreenGrid', "screens([{id: 'review', title: 'Review', root: wf.col([wf.region('Details')])}], {cols: 1})"],
  ] as const;
  // Every public spec part must draw its example with only the band adapters it can build.
  const specBands = {
    'box caption grid group group-row': ['affinity'],
    'areas box caption connect group': ['board'],
    'box connect row': ['steps'],
    'box caption connect group group-row row spacer': ['versus'],
    'caption cause': ['why-why-tree'],
    'box connect swimlane': ['swimlane'],
    bars: ['bars', 'histogram', 'pareto', 'range-bars'],
    catplot: ['boxplot'],
    causal: ['causal-loop'],
    cause: ['cause-tree', 'pdpc', 'relation-diagram'],
    classes: ['class-diagram'],
    dependency: ['dependency-network'],
    fta: ['fault-tree'],
    plane: ['burndown', 'burnup', 'control-chart', 'lines', 'scatter', 'strategy-canvas'],
    stacked: ['mekko', 'stacked-bars'],
    states: ['flowchart', 'state-diagram'],
    table: ['check-sheet', 'fmea', 'is-is-not', 'journey-map', 'matrix', 'qfd', 'raci', 'table', 'why-why-table'],
    tree: ['mindmap', 'tree'],
  };
  const standaloneSpecBands = [
    'bowtie', 'bpmn', 'bubble', 'butterfly', 'chevron', 'cloud', 'combo', 'compare', 'concentric', 'cycle',
    'funnel', 'gantt', 'harvey', 'heatmap', 'pert', 'pyramid', 'quadrant', 'radar', 'sankey', 'sequence',
    'timeline', 'tornado', 'treemap', 'value-chain', 'venn', 'waterfall',
  ];
  const specBandEntries = [
    ...Object.entries(specBands).flatMap(([bands, parts]) => parts.map(part => ({
      part, bands: bands.split(' ').map(band => band + '.js').sort(),
    }))),
    ...standaloneSpecBands.map(part => ({part, bands: [part + '.js']})),
  ];
  const {exports: published} = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {exports: Record<string, ExportTarget>};
  // Minified byte budgets for the catalog examples, with 10% headroom rounded up to 1,000 bytes.
  const specBudgets = new Map<string, Budget>([
    ['affinity', {esbuild: 119000, Vite: 149000}],
    ['bars', {esbuild: 87000, Vite: 112000}],
    ['board', {esbuild: 167000, Vite: 210000}],
    ['bowtie', {esbuild: 79000, Vite: 99000}],
    ['boxplot', {esbuild: 89000, Vite: 110000}],
    ['bpmn', {esbuild: 128000, Vite: 170000}],
    ['bubble', {esbuild: 83000, Vite: 103000}],
    ['burndown', {esbuild: 84000, Vite: 110000}],
    ['burnup', {esbuild: 84000, Vite: 111000}],
    ['butterfly', {esbuild: 77000, Vite: 100900}],
    ['causal-loop', {esbuild: 160000, Vite: 216000}],
    ['cause-tree', {esbuild: 191000, Vite: 254000}],
    ['check-sheet', {esbuild: 100000, Vite: 121000}],
    ['chevron', {esbuild: 69200, Vite: 91000}],
    ['class-diagram', {esbuild: 147000, Vite: 203000}],
    ['cloud', {esbuild: 72100, Vite: 93300}],
    ['combo', {esbuild: 87000, Vite: 108000}],
    ['compare', {esbuild: 79000, Vite: 103000}],
    ['concentric', {esbuild: 85000, Vite: 112000}],
    ['control-chart', {esbuild: 107000, Vite: 135000}],
    ['cycle', {esbuild: 73000, Vite: 96000}],
    ['dependency-network', {esbuild: 148000, Vite: 200000}],
    ['fault-tree', {esbuild: 96000, Vite: 122000}],
    ['flowchart', {esbuild: 170000, Vite: 230000}],
    ['fmea', {esbuild: 100000, Vite: 122000}],
    ['funnel', {esbuild: 68300, Vite: 89700}],
    ['gantt', {esbuild: 69000, Vite: 94600}],
    ['harvey', {esbuild: 80000, Vite: 99000}],
    ['heatmap', {esbuild: 80000, Vite: 99000}],
    ['histogram', {esbuild: 90000, Vite: 116000}],
    ['is-is-not', {esbuild: 100000, Vite: 121000}],
    ['journey-map', {esbuild: 99000, Vite: 121000}],
    ['lines', {esbuild: 85000, Vite: 111000}],
    ['matrix', {esbuild: 101000, Vite: 122000}],
    ['mekko', {esbuild: 85000, Vite: 104000}],
    ['mindmap', {esbuild: 94000, Vite: 122000}],
    ['pareto', {esbuild: 88000, Vite: 113000}],
    ['pdpc', {esbuild: 191000, Vite: 254000}],
    ['pert', {esbuild: 148000, Vite: 199000}],
    ['pyramid', {esbuild: 59300, Vite: 77900}],
    ['qfd', {esbuild: 100000, Vite: 122000}],
    ['quadrant', {esbuild: 108000, Vite: 135000}],
    ['raci', {esbuild: 100000, Vite: 122000}],
    ['radar', {esbuild: 82000, Vite: 101000}],
    ['range-bars', {esbuild: 86000, Vite: 111000}],
    ['relation-diagram', {esbuild: 192000, Vite: 255000}],
    ['sankey', {esbuild: 90000, Vite: 110000}],
    ['scatter', {esbuild: 83000, Vite: 107000}],
    ['sequence', {esbuild: 74000, Vite: 99500}],
    ['stacked-bars', {esbuild: 85000, Vite: 105000}],
    ['state-diagram', {esbuild: 169000, Vite: 229000}],
    ['steps', {esbuild: 141000, Vite: 178000}],
    ['strategy-canvas', {esbuild: 84000, Vite: 110000}],
    ['swimlane', {esbuild: 152000, Vite: 192000}],
    ['table', {esbuild: 80000, Vite: 100000}],
    ['timeline', {esbuild: 76000, Vite: 98000}],
    ['tornado', {esbuild: 83000, Vite: 102000}],
    ['tree', {esbuild: 92000, Vite: 121000}],
    ['treemap', {esbuild: 80000, Vite: 100000}],
    ['value-chain', {esbuild: 68800, Vite: 90500}],
    ['venn', {esbuild: 67100, Vite: 88500}],
    ['versus', {esbuild: 152000, Vite: 190000}],
    ['waterfall', {esbuild: 86000, Vite: 106000}],
    ['why-why-table', {esbuild: 100000, Vite: 121000}],
    ['why-why-tree', {esbuild: 206000, Vite: 272000}],
  ]);
  assert.deepEqual([...specBudgets.keys()].sort(), specBandEntries.map(({part}) => part).sort(),
    '公開 spec 部品ごとのバンドルサイズ上限');
  const specCases = specBandEntries.map(({part, bands}) => {
    const binding = part.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) + 'Part';
    return {
      name: 'Spec catalog: ' + part,
      source: `
        import {renderSpec} from 'svg-diagram/spec/selective';
        import {${binding}} from 'svg-diagram/spec/parts/${part}';
        export const draw = () => renderSpec({version: 1, title: 'Catalog example', legend: false, parts: [${binding}.example]}, {
          measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [${binding}],
        });
      `,
      include: 'spec-parts/selective/' + part + '.js',
      budget: specBudgets.get(part),
      exclude: [...legacy, 'lib/spec.js', 'dsl-pure.js', 'legend-notation.js',
        ...Array.from({length: 7}, (_, n) => 'spec-parts/r' + (n + 1) + '.js'),
        ...(!bands.includes('cause.js') ? ['toc-rules.js'] : []),
        ...(!bands.includes('connect.js') ? ['verify-connection-graph.js'] : []),
        ...(!bands.some(band => /^(?:cause|states|classes|tree|fta|bowtie)\.js$/.test(band)) ? ['verify-layout-fit.js'] : []),
        ...(!bands.includes('fta.js') ? ['fta-rules.js'] : []),
        ...(!bands.includes('table.js') ? ['table-rules.js', 'table-number-rules.js'] : []),
        ...(!bands.includes('swimlane.js') ? ['swimlane-rules.js'] : []),
        ...(!bands.some(band => ['box.js', 'group.js', 'grid.js', 'row.js', 'quadrant.js'].includes(band)) ? ['layout-metrics.js'] : [])],
      bands, draw: true, catalog: true,
    };
  });
  const measure = '({text, size}) => ({w: [...text].length * size * 0.6, h: size})';
  const edgeTable = "{version: 1, title: 'Plan', parts: [{type: 'table', columns: [{label: 'Review'}], rows: [['Done']]}]}";
  const edgeEngine = `const engine = {
    measure: ${measure},
    textBox: (text, _font, size) => ({w: [...text].length * size * 0.6, ascent: size, descent: 0}),
    font: {
      covers: () => true,
      shape: text => ({upem: 1000, glyphs: [...text].map(char => ({id: char.codePointAt(0), xAdvance: 600, xOffset: 0, yOffset: 0}))}),
      path: () => 'M0 0 L100 0 L100 100 Z',
    },
  };`;
  const edgePptxOptions = "{rasterize() { throw new Error('a native table does not need rasterization'); }}";
  const tinySvg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>';
  // Measuring real text on a browser canvas needs a browser Canvas implementation.
  const browserMeasureCase = {name: '文字測定', source: "export {canvasMeasurer} from 'svg-diagram/measure/browser';",
    include: 'web-measure.js', exclude: ['web.js', 'emit-html.js', 'pipeline.js', 'layout-handlers.js', 'spotlight.js', 'emit-spotlight.js'],
    budget: {esbuild: 4000, Vite: 4000}};
  const comicDrawCases = [false, true].map(browserMeasure => ({
    name: browserMeasure ? 'Comic + browser measurer' : 'Comic',
    source: `
      import {renderBands} from 'svg-diagram/core';
      import {comic} from 'svg-diagram/bands/comic';
      ${browserMeasure ? "export {svgMeasurer} from 'svg-diagram/measure/browser';" : ''}
      const sheet = {
        version: 1, title: 'Review', layout: '1x2', cast: {}, panels: [
          {id: 'first', stage: [], dialogue: [{id: 'note', kind: 'narration', tpl: 'Review'}]},
          {id: 'second', stage: [], dialogue: []},
        ],
      };
      export const draw = (measure = ${measure}) => renderBands([comic(sheet)], {width: 492, measure});
    `,
    include: 'bands/comic.js', draw: true,
    exclude: [...legacy, 'full-definitions.js', 'dsl-pure.js', 'layout-measure.js', 'layout-connect.js',
      'reveal-handlers.js', 'band-ids.js', 'comic/render.js', 'emit-html.js', 'emit-figures.js',
      'lib/spec.js', 'lib/pptx.js', 'lib/measure.js', 'font-metrics.js', 'icon-registry.js', 'icon-builtins.js',
      ...(!browserMeasure ? ['web-measure.js'] : [])],
    budget: browserMeasure ? {esbuild: 92000, Vite: 110900} : {esbuild: 90700, Vite: 109400},
  }));
  // New budgets are measured minified sizes with about 10% headroom per bundler.
  const browserDrawCases = [
    {name: './browser', source: `
      import {box, diagram, renderInBrowser} from 'svg-diagram/browser';
      export const draw = () => renderInBrowser(diagram({theme: 'blue'}).add(box({title: 'Review'})), {measure: ${measure}});
    `, include: 'web.js', exclude: ['emit-html.js', 'math-tex.js'],
    budget: {esbuild: 1148000, Vite: 1448000}, check: reviewDrawing},
    {name: './spec', source: `
      import {specToDiagram} from 'svg-diagram/spec';
      import {renderInBrowser} from 'svg-diagram/browser';
      export const draw = () => renderInBrowser(specToDiagram(${edgeTable}), {measure: ${measure}});
    `, include: 'lib/spec.js', exclude: ['emit-html.js', 'math-tex.js'],
    budget: {esbuild: 1326000, Vite: 1659000}, check: reviewDrawing},
    {name: './spec/edge', source: `
      import {renderSpecEdge} from 'svg-diagram/spec/edge';
      ${edgeEngine}
      export const draw = () => renderSpecEdge(${edgeTable}, engine);
    `, include: 'spec-edge.js', exclude: ['emit-html.js', 'math-tex.js'],
    budget: {esbuild: 1358000, Vite: 1703000},
    check: (result: {ok: boolean; svg: string}, label: string) => {
      assert.equal(result.ok, true, label);
      assert.match(result.svg, /<svg\b[\s\S]*aria-label="Review"[\s\S]*<use href="#sd-glyph-/, label);
      assert.doesNotMatch(result.svg, /<text\b/, label);
    }},
    {name: './pptx/edge', source: `
      import {renderPptxEdge} from 'svg-diagram/pptx/edge';
      ${edgeEngine}
      export const draw = () => renderPptxEdge(${edgeTable}, engine, ${edgePptxOptions});
    `, include: 'pptx-edge.js', exclude: ['pptx/zip-node.js', 'math-tex.js'],
    budget: {esbuild: 1458000, Vite: 1820000},
    check: (result: {issues: unknown[]; native: number; pictures: number; pptx: Uint8Array}, label: string) => {
      assert.deepEqual(result.issues, [], label);
      assert.equal(result.native, 1, label);
      assert.equal(result.pictures, 0, label);
      zipHeader(result.pptx, label);
    }},
    {name: './pptx/deck/edge', source: `
      import {renderDeckPptxEdge} from 'svg-diagram/pptx/deck/edge';
      ${edgeEngine}
      export const draw = () => renderDeckPptxEdge({slides: [{title: 'Plan', figure: ${edgeTable}}]}, engine, ${edgePptxOptions});
    `, include: 'pptx-deck-edge.js', exclude: ['pptx/zip-node.js', 'math-tex.js'],
    budget: {esbuild: 1488000, Vite: 1859000},
    check: (result: {issues: unknown[]; slides: {native: number; pictures: number}[]; pptx: Uint8Array}, label: string) => {
      assert.deepEqual(result.issues, [], label);
      assert.deepEqual(result.slides.map(({native, pictures}) => [native, pictures]), [[1, 0]], label);
      zipHeader(result.pptx, label);
    }},
    {name: './html', source: `
      import {emitHtml} from 'svg-diagram/html';
      import {prepareBands} from 'svg-diagram/core';
      import {box} from 'svg-diagram/bands/box';
      export const draw = async () => {
        const {placed} = await prepareBands([box({title: 'Review'})], {measure: ${measure}});
        return emitHtml(placed, {fontBox: size => ({ascent: size, descent: 0})});
      };
    `, include: 'emit-html.js', exclude: ['web.js', 'web-measure.js'],
    budget: {esbuild: 239000, Vite: 233000}, check: reviewHtml},
    {name: './html/bands', source: `
      import {boxHtml} from 'svg-diagram/html/bands';
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {box} from 'svg-diagram/bands/box';
      export const draw = () => renderBandsHtml([box({title: 'Review'})], {
        measure: ${measure}, fontBox: size => ({ascent: size, descent: 0}),
        adapters: {box: boxHtml}, strict: true,
      });
    `, include: 'html-box-band.js', exclude: [...legacy, 'html-table.js', 'emit-html.js'],
    budget: {esbuild: 80000, Vite: 101000},
    check: (result: {html: string; verdict: {ok: boolean}}, label: string) => {
      assert.equal(result.verdict.ok, true, label);
      reviewHtml(result.html, label);
    }},
    {name: './zip', source: `
      import {zipEntries} from 'svg-diagram/zip';
      export const draw = () => zipEntries([{name: 'figure.svg', data: new TextEncoder().encode(${JSON.stringify(tinySvg)})}]);
    `, include: 'pptx/zip.js', exclude: [...legacy, 'pptx/selective.js', 'pptx/zip-node.js', 'lib/core.js', 'lib/png.js'],
    budget: {esbuild: 1800, Vite: 2300},
    check: (zip: Uint8Array, label: string) => {
      zipHeader(zip, label);
      assert.ok(new TextDecoder().decode(zip).includes('figure.svg' + tinySvg), label);
    }},
  ];
  const cases = [
    ...browserDrawCases,
    ...comicDrawCases,
    ...specCases,
    {name: 'HTML box adapter', source: "export {boxHtml} from 'svg-diagram/html/bands/box';",
      include: 'box-style.js', budget: {esbuild: 5500, Vite: 6500},
      exclude: [...legacy, 'emit-common.js', 'emit-box.js', 'html-banner.js', 'html-grid.js', 'html-row.js', 'html-table.js', 'html-document.js', 'sha1.js']},
    {name: 'HTML row adapter', source: "export {rowHtml} from 'svg-diagram/html/bands/row';",
      include: 'html-row.js', budget: {esbuild: 5000, Vite: 6200},
      exclude: [...legacy, 'html-grid.js', 'html-group.js', 'html-table.js', 'html-overlay.js', 'html-document.js', 'sha1.js']},
    {name: 'HTML grid adapter', source: "export {gridHtml} from 'svg-diagram/html/bands/grid';",
      include: 'html-grid.js', budget: {esbuild: 5000, Vite: 6200},
      exclude: [...legacy, 'html-row.js', 'html-group.js', 'html-table.js', 'html-overlay.js', 'html-document.js', 'sha1.js']},
    {name: 'Selective HTML', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {boxHtml} from 'svg-diagram/html/bands/box';
      import {box} from 'svg-diagram/bands/box';
      export const draw = () => renderBandsHtml([box({title: 'Review'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {box: boxHtml}, strict: true,
      });
    `, include: 'html-selective.js', budget: {esbuild: 87000, Vite: 111000}, bands: ['box.js'], exclude: [...legacy, 'html-box.js', 'html-row.js', 'html-grid.js', 'html-group.js', 'emit-html.js', 'lib/emit.js', 'svg-to-css.js', 'html-overlay.js', 'html-native.js', 'html-table.js', 'emit-tables.js', 'image-file.js'], draw: true},
    {name: 'Selective HTML caption', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {captionHtml} from 'svg-diagram/html/bands/caption';
      import {caption} from 'svg-diagram/bands/caption';
      export const draw = () => renderBandsHtml([caption('Review')], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {caption: captionHtml}, strict: true,
      });
    `, include: 'html-caption.js', budget: {esbuild: 56500, Vite: 72500}, bands: ['caption.js'],
      exclude: [...legacy, 'html-box.js', 'html-table.js', 'html-native.js', 'html-overlay.js', 'layout-connect.js'], draw: true},
    {name: 'Selective HTML banner', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {bannerHtml} from 'svg-diagram/html/bands/banner';
      import {banner} from 'svg-diagram/bands/banner';
      export const draw = () => renderBandsHtml([banner({headline: 'Review'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {banner: bannerHtml}, strict: true,
      });
    `, include: 'html-banner.js', budget: {esbuild: 58000, Vite: 77000}, bands: ['banner.js'],
      exclude: [...legacy, 'html-box.js', 'html-table.js', 'html-native.js', 'html-overlay.js', 'layout-connect.js'], draw: true},
    {name: 'Selective HTML image', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {image} from 'svg-diagram/bands/image';
      export const draw = () => renderBandsHtml([image('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', {
        id: 'picture', alt: 'Review', width: 240,
      })], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
      });
    `, include: 'emit-image.js', budget: {esbuild: 70000, Vite: 92500}, bands: ['image.js'],
      exclude: [...legacy, 'image-file.js', 'html-native.js', 'html-overlay.js', 'html-box-band.js', 'html-table.js'], draw: true},
    {name: 'Selective HTML grid', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {gridHtml} from 'svg-diagram/html/bands/grid';
      import {box} from 'svg-diagram/bands/box';
      import {grid} from 'svg-diagram/bands/grid';
      export const draw = () => renderBandsHtml([grid([box({title: 'Review'})], {cols: 2})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {grid: gridHtml}, strict: true,
      });
    `, include: 'html-grid.js', budget: {esbuild: 92000, Vite: 119000}, bands: ['box.js', 'grid.js'],
      exclude: [...legacy, 'html-box.js', 'html-row.js', 'html-group.js', 'html-table.js', 'layout-connect.js'], draw: true},
    {name: 'Selective HTML row', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {rowHtml} from 'svg-diagram/html/bands/row';
      import {box} from 'svg-diagram/bands/box';
      import {row} from 'svg-diagram/bands/row';
      export const draw = () => renderBandsHtml([row([box({title: 'Review'}), box({title: 'Done'})])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {row: rowHtml}, strict: true,
      });
    `, include: 'html-row.js', budget: {esbuild: 92000, Vite: 118000}, bands: ['box.js', 'row.js'],
      exclude: [...legacy, 'html-box.js', 'html-grid.js', 'html-group.js', 'html-table.js'], draw: true},
    {name: 'Selective HTML group', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {groupHtml} from 'svg-diagram/html/bands/group';
      import {boxHtml} from 'svg-diagram/html/bands/box';
      import {box} from 'svg-diagram/bands/box';
      import {group} from 'svg-diagram/bands/group';
      export const draw = () => renderBandsHtml([group(box({title: 'Review'}))], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {group: groupHtml, box: boxHtml}, strict: true,
      });
    `, include: 'html-group.js', budget: {esbuild: 92000, Vite: 119000}, bands: ['box.js', 'caption.js', 'group.js'],
      exclude: [...legacy, 'html-box.js', 'html-grid.js', 'html-row.js', 'html-table.js', 'layout-connect.js'], draw: true},
    {name: 'Selective HTML table', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {tableHtml} from 'svg-diagram/html/bands/table';
      import {table} from 'svg-diagram/bands/table';
      export const draw = () => renderBandsHtml([table([{label: 'Review'}], [['Done']])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {table: tableHtml}, strict: true,
      });
    `, include: 'html-table.js', budget: {esbuild: 81500, Vite: 104500}, bands: ['table.js'],
      exclude: [...legacy, 'html-box.js', 'html-native.js', 'emit-html.js', 'layout-connect.js'], draw: true},
    {name: 'Selective HTML overlay', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {renderHtmlOverlay} from 'svg-diagram/html/overlay';
      import {curve} from 'svg-diagram/bands/curve';
      export const draw = () => renderBandsHtml([curve([{y: 0.3}, {y: 0.8}], {xLabel: 'Review'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        overlay: renderHtmlOverlay,
      });
    `, include: 'html-overlay.js', budget: {esbuild: 71000, Vite: 95500}, bands: ['curve.js'],
      exclude: [...legacy, 'html-native.js', 'html-box.js', 'html-table.js', 'emit-html.js', 'layout-connect.js'], draw: true},
    {name: 'Selective PPTX', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {rowPptx} from 'svg-diagram/pptx/bands/row';
      import {row} from 'svg-diagram/bands/row';
      import {box} from 'svg-diagram/bands/box';
      export const draw = () => renderBandsPptx([row([box({title: 'Review'}), box({title: 'Done'})], {arrows: 'between'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {row: rowPptx}, strict: true,
      });
    `, include: 'pptx/selective.js', budget: {esbuild: 155000, Vite: 184000}, bands: ['box.js', 'row.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/box-bands.js', 'pptx/grid-band.js', 'pptx/group-band.js', 'pptx/slide.js', 'pptx/image-band.js', 'pptx/table.js', 'pptx/group-span.js', 'pptx/swimlane-span.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js', 'svg-outline.js', 'lib/emit.js'], draw: true},
    {name: 'PPTX flow adapter', source: "export {flowPptx} from 'svg-diagram/pptx/bands/flow';",
      include: 'pptx/line-shapes.js', budget: {esbuild: 30000, Vite: 38000},
      exclude: [...legacy, 'pptx/connectors.js', 'pptx/row-arrow.js', 'pptx/pyramid-band.js', 'pptx/timeline-band.js', 'pptx/svg-shapes.js']},
    {name: 'PPTX quadrant adapter', source: "export {quadrantPptx} from 'svg-diagram/pptx/bands/quadrant';",
      include: 'pptx/quadrant.js', budget: {esbuild: 22600, Vite: 29500},
      exclude: [...legacy, 'lib/quadrant.js', 'bands/quadrant.js', 'pptx/svg-shapes.js', 'pptx/cause.js']},
    {name: 'PPTX swimlane span', source: "export {swimlaneSpan} from 'svg-diagram/pptx/bands/swimlane';",
      include: 'pptx/swimlane-span.js', budget: {esbuild: 1000, Vite: 1200},
      exclude: [...legacy, 'bands/swimlane.js', 'pptx/group-span.js', 'pptx/bands.js', 'pptx/svg-shapes.js']},
    {name: 'PPTX row adapter', source: "export {rowPptx} from 'svg-diagram/pptx/bands/row';",
      include: 'pptx/row-arrow.js', budget: {esbuild: 19500, Vite: 24000},
      exclude: [...legacy, 'pptx/connectors.js', 'pptx/grid-band.js', 'pptx/group-band.js', 'pptx/svg-shapes.js', 'emit-common.js']},
    {name: 'PPTX box adapter', source: "export {boxPptx} from 'svg-diagram/pptx/bands/box';",
      include: 'box-step-geometry.js', budget: {esbuild: 18000, Vite: 23500},
      exclude: [...legacy, 'pptx/banner-band.js', 'pptx/grid-band.js', 'pptx/row-band.js', 'pptx/svg-shapes.js', 'emit-common.js', 'emit-box.js', 'emit-boxes.js', 'icon-svg.js']},
    {name: 'Selective PPTX image', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {image} from 'svg-diagram/bands/image';
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==';
      export const draw = () => renderBandsPptx([image('data:image/png;base64,' + png, {id: 'picture', alt: 'Review', width: 240})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        rasterize: () => Uint8Array.from(atob(png), char => char.charCodeAt(0)),
      });
    `, include: 'emit-image.js', budget: {esbuild: 115000, Vite: 135000}, bands: ['image.js'],
      exclude: [...legacy, 'image-file.js', 'pptx/bands.js', 'pptx/image-band.js', 'pptx/box-band.js', 'pptx/table-band.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js'], draw: true},
    {name: 'Selective PPTX Caption', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {captionPptx} from 'svg-diagram/pptx/bands/caption';
      import {caption} from 'svg-diagram/bands/caption';
      export const draw = () => renderBandsPptx([caption('Review')], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {caption: captionPptx}, strict: true,
      });
    `, include: 'pptx/caption-band.js', budget: {esbuild: 115000, Vite: 133500}, bands: ['caption.js'],
      exclude: [...legacy, 'pptx/box-bands.js', 'pptx/bands.js', 'pptx/table-band.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js'], draw: true},
    {name: 'Selective PPTX Legend', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {legendPptx} from 'svg-diagram/pptx/bands/legend';
      import {legend} from 'svg-diagram/bands/legend';
      export const draw = () => renderBandsPptx([legend([{label: 'Review', edge: 'and'}, {label: 'Blocked', edge: 'blocks'}])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {legend: legendPptx}, strict: true,
      });
    `, include: 'pptx/legend-band.js', budget: {esbuild: 112000, Vite: 131000}, bands: ['legend.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/cause-band.js', 'pptx/box-band.js', 'pptx/table-band.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js', 'legend-notation.js', 'layout-connect.js'], draw: true},
    {name: 'Selective PPTX Banner', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {bannerPptx} from 'svg-diagram/pptx/bands/banner';
      import {banner} from 'svg-diagram/bands/banner';
      export const draw = () => renderBandsPptx([banner({headline: 'Review'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {banner: bannerPptx}, strict: true,
      });
    `, include: 'pptx/banner-band.js', budget: {esbuild: 110000, Vite: 140700}, bands: ['banner.js'],
      exclude: [...legacy, 'pptx/box-band.js', 'emit-box.js', 'pptx/box-bands.js', 'pptx/bands.js', 'pptx/table-band.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js'], draw: true},
    {name: 'Selective PPTX Grid', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {gridPptx} from 'svg-diagram/pptx/bands/grid';
      import {box} from 'svg-diagram/bands/box';
      import {grid} from 'svg-diagram/bands/grid';
      export const draw = () => renderBandsPptx([grid([box({title: 'Review'})], {cols: 2})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {grid: gridPptx}, strict: true,
      });
    `, include: 'pptx/grid-band.js', budget: {esbuild: 145000, Vite: 175000}, bands: ['box.js', 'grid.js'],
      exclude: [...legacy, 'pptx/row-band.js', 'pptx/group-band.js', 'pptx/box-bands.js', 'pptx/bands.js', 'pptx/svg-shapes.js'], draw: true},
    {name: 'Selective PPTX SVG shapes', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {svgShapesXml} from 'svg-diagram/pptx/svg-shapes';
      import {box} from 'svg-diagram/bands/box';
      export const draw = () => renderBandsPptx([box({title: 'Review'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        svgShapes: svgShapesXml, strict: true,
      });
    `, include: 'pptx/svg-shapes.js', budget: {esbuild: 162500, Vite: 198500}, bands: ['box.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/slide.js', 'pptx/box-bands.js', 'pptx/table.js', 'pptx/zip-node.js', 'lib/emit.js'], draw: true},
    {name: 'Selective PPTX Table', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {tablePptx} from 'svg-diagram/pptx/bands/table';
      import {table} from 'svg-diagram/bands/table';
      export const draw = () => renderBandsPptx([table([{label: 'Review'}], [['Done']])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {table: tablePptx}, strict: true,
      });
    `, include: 'pptx/table-band.js', budget: {esbuild: 140000, Vite: 166000}, bands: ['table.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/slide.js', 'pptx/box-bands.js', 'pptx/tree-band.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js', 'lib/emit.js'], draw: true},
    {name: 'Selective PPTX Group', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {boxPptx} from 'svg-diagram/pptx/bands/box';
      import {groupPptx, groupSpan} from 'svg-diagram/pptx/bands/group';
      import {box} from 'svg-diagram/bands/box';
      import {group} from 'svg-diagram/bands/group';
      export const draw = () => renderBandsPptx([group(box({title: 'Review'}))], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {box: boxPptx, group: groupPptx}, spans: {group: groupSpan}, strict: true,
      });
    `, include: 'pptx/group-span.js', budget: {esbuild: 150000, Vite: 179000}, bands: ['box.js', 'caption.js', 'group.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/swimlane-span.js', 'pptx/svg-shapes.js'], draw: true},
    {name: 'Selective PPTX Flow', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {flowPptx} from 'svg-diagram/pptx/bands/flow';
      import {chevron} from 'svg-diagram/bands/chevron';
      export const draw = () => renderBandsPptx([chevron([{label: 'Review'}, {label: 'Next'}])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {chevron: flowPptx}, strict: true,
      });
    `, include: 'pptx/flow.js', budget: {esbuild: 143000, Vite: 173000}, bands: ['chevron.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/pyramid.js', 'pptx/timeline.js'], draw: true},
    {name: 'Selective PPTX Pyramid', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {pyramidPptx} from 'svg-diagram/pptx/bands/pyramid';
      import {pyramid} from 'svg-diagram/bands/pyramid';
      export const draw = () => renderBandsPptx([pyramid(['Review', 'Base'])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {pyramid: pyramidPptx}, strict: true,
      });
    `, include: 'pptx/pyramid.js', budget: {esbuild: 123000, Vite: 148000}, bands: ['pyramid.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/flow.js', 'pptx/timeline.js'], draw: true},
    {name: 'Selective PPTX Quadrant', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {quadrantPptx} from 'svg-diagram/pptx/bands/quadrant';
      import {quadrant} from 'svg-diagram/bands/quadrant';
      export const draw = () => renderBandsPptx([quadrant.preset('bcg', {items: [{label: 'Review', cell: [0, 0]}]})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {quadrant: quadrantPptx}, strict: true,
      });
    `, include: 'pptx/quadrant-band.js', budget: {esbuild: 167000, Vite: 199000}, bands: ['quadrant.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/cause.js', 'pptx/states.js', 'pptx/svg-shapes.js'], draw: true},
    {name: 'Selective PPTX Swimlane', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {swimlaneSpan} from 'svg-diagram/pptx/bands/swimlane';
      import {boxPptx} from 'svg-diagram/pptx/bands/box';
      import {svgShapesXml} from 'svg-diagram/pptx/svg-shapes';
      import {swimlane} from 'svg-diagram/bands/swimlane';
      export const draw = () => renderBandsPptx(swimlane([{id: 'work', label: 'Work'}], [{id: 'a', lane: 'work', title: 'Review'}]), {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {box: boxPptx}, spans: {swimlane: swimlaneSpan}, svgShapes: svgShapesXml, strict: true,
      });
    `, include: 'pptx/swimlane-span.js', budget: {esbuild: 185000, Vite: 224000}, bands: ['box.js', 'swimlane.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/group-span.js', 'pptx/cause.js', 'pptx/states.js'], draw: true},
    {name: 'Selective PPTX Cause', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {causePptx} from 'svg-diagram/pptx/bands/cause';
      import {causeTree} from 'svg-diagram/bands/cause';
      export const draw = () => renderBandsPptx([causeTree([{id: 'a', label: 'Review'}, {id: 'b', label: 'Next'}], [{from: 'a', to: 'b'}])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {cause: causePptx}, strict: true,
      });
    `, include: 'pptx/cause.js', budget: {esbuild: 245000, Vite: 310000}, bands: ['cause.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/states.js', 'pptx/tree.js', 'pptx/svg-shapes.js'], draw: true},
    {name: 'Selective PPTX States', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {statesPptx} from 'svg-diagram/pptx/bands/states';
      import {flowchart} from 'svg-diagram/bands/states';
      export const draw = () => renderBandsPptx([flowchart([{id: 'a', label: 'Review'}, {id: 'b', label: 'Next'}], [{from: 'a', to: 'b'}])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {states: statesPptx}, strict: true,
      });
    `, include: 'pptx/states.js', budget: {esbuild: 225000, Vite: 287000}, bands: ['states.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/cause.js', 'pptx/tree.js', 'pptx/svg-shapes.js'], draw: true},
    {name: 'Selective PPTX Tree', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {treePptx} from 'svg-diagram/pptx/bands/tree';
      import {tree} from 'svg-diagram/bands/tree';
      export const draw = () => renderBandsPptx([tree({label: 'Review', children: [{label: 'Next'}]})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {tree: treePptx}, strict: true,
      });
    `, include: 'pptx/tree.js', budget: {esbuild: 147000, Vite: 180000}, bands: ['tree.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/cause.js', 'pptx/states.js', 'pptx/svg-shapes.js'], draw: true},
    {name: 'Selective PPTX Timeline', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {timelinePptx} from 'svg-diagram/pptx/bands/timeline';
      import {timeline} from 'svg-diagram/bands/timeline';
      export const draw = () => renderBandsPptx([timeline({unit: 'ms', from: 0, to: 100, events: [{at: 25, label: 'Review'}]})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {timeline: timelinePptx}, strict: true,
      });
    `, include: 'pptx/timeline.js', budget: {esbuild: 145000, Vite: 178000}, bands: ['timeline.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/flow.js', 'pptx/pyramid.js'], draw: true},
    {name: 'RACI table', source: composedSource([], "raci(['Review'], ['Owner', 'Writer'], [['A', 'R']])",
      "import {raci} from 'svg-diagram/bands/table';"), include: 'bands/table.js',
      budget: {esbuild: 96000, Vite: 120000}, bands: ['table.js'],
      exclude: [...legacy, 'bands/cause.js', 'bands/screens.js', 'bands/sequence.js', 'bands/gantt.js'], draw: true},
    {name: 'Composer Why-why tree', source: composedSource([], "...whyWhyTree('Review', [{why: 'Missing tests', trueCause: true}])",
      "import {whyWhyTree} from 'svg-diagram/compose/why-why-tree';"),
      include: 'compose/selective/why-why-tree.js', budget: {esbuild: 187000, Vite: 249500}, bands: ['caption.js', 'cause.js'],
      exclude: [...legacy, 'bands/states.js', 'bands/table.js', 'bands/box.js', 'bands/gantt.js', 'qc.js'], draw: true},
    {name: 'Composer Arrow diagram', source: composedSource([], "...arrowDiagram([{from: 1, to: 2, name: 'Review', days: 3}])",
      "import {arrowDiagram} from 'svg-diagram/compose/arrow-diagram';"),
      include: 'compose/selective/arrow-diagram.js', budget: {esbuild: 169000, Vite: 229000}, bands: ['caption.js', 'states.js'],
      exclude: [...legacy, 'bands/cause.js', 'bands/group.js', 'bands/row.js', 'layout-connect.js', 'rca-rules.js'], draw: true},
    {name: 'State matrix', layout: 'layoutStateMatrix', source: composedSource([], "stateMatrix(['Review'], [{label: 'Page', cells: [wf.text('Ready')]}])",
      "import {stateMatrix, wf} from 'svg-diagram/bands/screens';"),
      include: 'state-matrix-rules.js', budget: {esbuild: 102500, Vite: 139000}, bands: ['screens.js'],
      exclude: [...legacy, 'dsl/wireframe.js', 'bands/wireframe.js', 'bands/table.js', 'layout-connect.js'], draw: true},
    {name: 'Composer Affinity', source: composedSource([], "...affinity([{title: 'Review', cards: ['First', 'Second']}, {title: 'Plan', groups: [{title: 'Prepare', cards: ['Third']}]}], {cardCols: 2})",
      "import {affinity} from 'svg-diagram/compose/affinity';"),
      include: 'compose/selective/affinity.js', budget: {esbuild: 104500, Vite: 132500}, bands: ['box.js', 'caption.js', 'grid.js', 'group-row.js', 'group.js'],
      exclude: [...legacy, 'bands/row.js', 'dsl/diagrams.js', 'layout-connect.js', 'bands/areas.js', 'bands/cause.js', 'spec-selective.js'], draw: true},
    {name: 'Composer Canvas', source: composedSource([], "canvas('swot', {strengths: 'Plan'}, {requireAll: true, titles: {strengths: 'Review'}})", "import {canvas} from 'svg-diagram/compose/canvas'; "),
      include: 'compose/selective/canvas.js', budget: {esbuild: 89000, Vite: 113500}, bands: ['box.js', 'grid.js'], exclude: [...legacy, 'layout-connect.js', 'bands/banner.js', 'bands/row.js'], draw: true},
    {name: 'Composer Hero', source: composedSource([], "...hero({banner: {headline: 'Review'}, flow: [box({title: 'Step'})], stat: {value: 3, label: 'Done'}})", "import {hero} from 'svg-diagram/compose/hero'; import {box} from 'svg-diagram/bands/box';"),
      include: 'compose/selective/hero.js', budget: {esbuild: 100500, Vite: 128000}, bands: ['banner.js', 'box.js', 'caption.js', 'row.js'], exclude: [...legacy, 'layout-connect.js', 'bands/grid.js', 'bands/group.js'], draw: true},
    {name: 'Composer Icon row', source: composedSource([], "iconRow([{icon: 'check', label: 'Review'}])", "import {iconRow} from 'svg-diagram/compose/icon-row'; import {icon} from 'svg-diagram/bands/box'; icon.has('check'); icon.use({version: 1, icons: {check: {d: 'M2 2h20v20H2z', vb: [0, 0, 24], from: 'file:check.svg', license: 'local'}}});"),
      include: 'compose/selective/icon-row.js', budget: {esbuild: 94000, Vite: 122500}, bands: ['box.js', 'row.js'], exclude: [...legacy, 'layout-connect.js', 'bands/grid.js', 'bands/banner.js'], draw: true},
    {name: 'Composer Versus', source: composedSource([], "...versus({children: box({title: 'Review'})}, {children: box({title: 'Next'})})", "import {versus} from 'svg-diagram/compose/versus'; import {box} from 'svg-diagram/bands/box';"),
      include: 'compose/selective/versus.js', budget: {esbuild: 140000, Vite: 175500}, bands: ['box.js', 'caption.js', 'connect.js', 'group-row.js', 'group.js', 'row.js', 'spacer.js'], exclude: [...legacy, 'bands/banner.js', 'bands/grid.js', 'gantt.js'], draw: true},
    {name: 'Selected pyramid spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {pyramidPart} from 'svg-diagram/spec/parts/pyramid';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'pyramid', layers: ['Review', 'Next']}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [pyramidPart],
      });
    `, include: 'spec-selective.js', budget: {esbuild: 70000, Vite: 93000}, bands: ['pyramid.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/flowchart.js', 'spec-parts/funnel.js', 'spec-parts/r1.js', 'dsl-pure.js', 'layout-connect.js', 'legend-notation.js', 'bands/legend.js'], draw: true},
    {name: 'Selected fault tree spec with legend', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {faultTreePart} from 'svg-diagram/spec/parts/fault-tree';
      import {autoLegend} from 'svg-diagram/bands/legend';
      export const draw = () => renderSpec({version: 1, title: 'Plan', lang: 'en', legend: 'auto',
        parts: [{type: 'faultTree', top: {label: 'Review', gate: 'or', children: [{label: 'Power', kind: 'basic'}, {label: 'Network', kind: 'basic'}]}}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [faultTreePart], autoLegend,
      });
    `, include: 'legend-notation.js', budget: {esbuild: 120500, Vite: 154000}, bands: ['fta.js', 'legend.js'],
      exclude: [...legacy, 'bands/cause.js', 'bands/table.js', 'dsl-pure.js'], draw: true},
    {name: 'Selected Edge PPTX table', source: `
      import {renderPptxEdge} from 'svg-diagram/pptx/selective/edge';
      import {tablePart} from 'svg-diagram/spec/parts/table';
      import {tablePptx} from 'svg-diagram/pptx/bands/table';
      const engine = {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        textBox: (text, _font, size) => ({w: [...text].length * size * 0.6, ascent: size, descent: 0}),
        font: {covers: () => true, shape: () => ({upem: 1000, glyphs: []}), path: () => ''},
      };
      export const draw = () => renderPptxEdge({version: 1, title: 'Plan', parts: [
        {type: 'table', columns: [{label: 'Review'}], rows: [['Done']]},
      ]}, engine, {
        parts: [tablePart], bands: {table: tablePptx},
        rasterize() { throw new Error('a native table does not need rasterization'); },
      });
    `, include: 'pptx-selective-edge.js', budget: {esbuild: 179500, Vite: 216500}, bands: ['table.js'],
      exclude: [...legacy, 'lib/spec.js', 'lib/pptx-edge.js', 'pptx/bands.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js', 'bands/box.js'], draw: true},
    {name: 'Selected Edge PPTX deck', source: `
      import {renderDeckPptxEdge} from 'svg-diagram/pptx/deck/selective/edge';
      import {tablePart} from 'svg-diagram/spec/parts/table';
      import {tablePptx} from 'svg-diagram/pptx/bands/table';
      const engine = {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        textBox: (text, _font, size) => ({w: [...text].length * size * 0.6, ascent: size, descent: 0}),
        font: {covers: () => true, shape: () => ({upem: 1000, glyphs: []}), path: () => ''},
      };
      const figure = {version: 1, title: 'Plan', parts: [
        {type: 'table', columns: [{label: 'Review'}], rows: [['Done']]},
      ]};
      export const draw = () => renderDeckPptxEdge({slides: [{title: 'Part', figure}, {title: 'Compare', columns: [{text: 'Context'}, {figure}]}]},
        engine, {parts: [tablePart], bands: {table: tablePptx}, rasterize() { throw new Error('a native table does not need rasterization'); }});
    `, include: 'pptx-deck-selective-edge.js', budget: {esbuild: 207500, Vite: 251500}, bands: ['table.js'],
      exclude: [...legacy, 'lib/spec.js', 'lib/deck-spec.js', 'lib/pptx-deck-edge.js', 'lib/pptx-edge.js', 'pptx/bands.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js'], draw: true},
    {name: 'Selected table spec on Edge', source: `
      import {renderSpecEdge} from 'svg-diagram/spec/selective/edge';
      import {tablePart} from 'svg-diagram/spec/parts/table';
      const engine = {
        measure: ({text, size}) => ({w: [...text].length * size, h: size}),
        textBox: (text, _font, size) => ({w: [...text].length * size, ascent: size, descent: 0}),
        font: {
          covers: () => true,
          shape: text => ({upem: 1000, glyphs: [...text].map(char => ({id: char.codePointAt(0), xAdvance: 1000, xOffset: 0, yOffset: 0}))}),
          path: () => 'M0 0 L100 0 L100 100 Z',
        },
      };
      export const draw = () => renderSpecEdge({version: 1, title: 'Plan', parts: [
        {type: 'table', columns: [{label: 'Review'}], rows: [['Done']]},
      ]}, engine, {parts: [tablePart]});
    `, include: 'spec-selective-edge.js', budget: {esbuild: 122000, Vite: 159000}, bands: ['table.js'],
      exclude: [...legacy, 'lib/spec.js', 'spec-edge.js', 'dsl-pure.js', 'bands/gantt.js', 'bands/box.js'], draw: true},
    {name: 'Selected table spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {tablePart} from 'svg-diagram/spec/parts/table';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'table', columns: [{label: 'Review'}], rows: [['Done']]}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [tablePart],
      });
    `, include: 'spec-parts/selective/table.js', budget: {esbuild: 91500, Vite: 117500}, bands: ['table.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/swimlane.js', 'spec-parts/gantt.js', 'dsl-pure.js', 'layout-connect.js', 'document-findings.js', 'term-rules.js'], draw: true},
    {name: 'Prepared table spec with description', source: `
      import {prepareSpecLayout} from 'svg-diagram/spec/selective';
      import {tablePart} from 'svg-diagram/spec/parts/table';
      export const draw = async () => {
        const spec = {version: 1, title: 'Plan', parts: [{type: 'table', columns: [{label: 'Review'}], rows: [['Done']]}]};
        const {placed, emit, verdict} = await prepareSpecLayout(spec, {parts: [tablePart]})(
          ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        );
        return {svg: emit(placed), verdict};
      };
    `, include: 'diagram-description.js', budget: {esbuild: 92500, Vite: 114000}, bands: ['table.js'],
      exclude: [...legacy, 'emit-connect.js', 'verify-connect-geometry.js', 'layout-box-like.js', 'layout-cause-fit.js', 'layout-caption-lines.js', 'layout-decoration.js', 'status.js', 'layout-connect-gaps.js', 'layout-areas-gaps.js', 'lib/spec.js', 'lib/bars.js', 'band-children.js', 'inventory-boxes.js', 'inventory-lines.js', 'layout-connect.js'], draw: true},
    {name: 'Selected heatmap spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {heatmapPart} from 'svg-diagram/spec/parts/heatmap';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'heatmap', rows: ['Review'], cols: ['Done'], values: [[1]]}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [heatmapPart],
      });
    `, include: 'spec-parts/selective/heatmap.js', budget: {esbuild: 107500, Vite: 133000}, bands: ['heatmap.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/r2.js', 'spec-parts/treemap.js', 'charts-treemap.js', 'charts-sankey.js', 'charts-tornado.js', 'dsl-pure.js'], draw: true},
    {name: 'Selected boxplot spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {boxplotPart} from 'svg-diagram/spec/parts/boxplot';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'boxplot', groups: [{label: 'Review', values: [1, 2, 3, 4, 5]}]}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [boxplotPart],
      });
    `, include: 'spec-parts/selective/boxplot.js', budget: {esbuild: 100000, Vite: 127000}, bands: ['catplot.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/r6.js', 'spec-parts/control-chart.js', 'charts-dist.js', 'charts-reg.js', 'charts-multi.js', 'dsl-pure.js'], draw: true},
    {name: 'Selected fault tree spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {faultTreePart} from 'svg-diagram/spec/parts/fault-tree';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'faultTree', top: {label: 'Review', gate: 'or', children: [{label: 'Power', kind: 'basic'}, {label: 'Network', kind: 'basic'}]}}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [faultTreePart],
      });
    `, include: 'spec-parts/selective/fault-tree.js', budget: {esbuild: 107000, Vite: 137500}, bands: ['fta.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/r4.js', 'spec-parts/matrix.js', 'spec-parts/bowtie.js', 'semnet-causal.js', 'dsl-pure.js'], draw: true},
    {name: 'Selected steps spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {stepsPart} from 'svg-diagram/spec/parts/steps';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'steps', items: [{title: 'Review'}, {title: 'Next'}], loopBack: [{from: 2, to: 1, label: 'Retry'}]}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [stepsPart],
      });
    `, include: 'spec-parts/selective/steps.js', budget: {esbuild: 146900, Vite: 186100}, bands: ['box.js', 'connect.js', 'row.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/r5.js', 'spec-parts/board.js', 'spec-parts/versus.js', 'dsl-pure.js'], draw: true},
    {name: 'Selected screen widgets', layout: 'layoutScreenGridWith', source: composedSource([], "screens([{id: 'review', title: 'Review', root: text('Details')}], {cols: 1})",
      "import {createScreenGrid, textRenderer} from 'svg-diagram/wireframe/renderers'; import {text} from 'svg-diagram/wireframe/parts'; const screens = createScreenGrid([textRenderer]);"),
      include: 'screens-definition.js', bands: [], budget: {esbuild: 58000, Vite: 78000},
      exclude: [...legacy, 'dsl/state-matrix.js', 'state-matrix-rules.js', 'lib/wireframe.js', 'lib/wireframe-parts.js', 'bands/screens.js', 'bands/wireframe-basic.js', 'layout-wireframes.js'], draw: true},
    {name: 'Selected matrix widgets', layout: 'layoutStateMatrixWith', source: composedSource([], "stateMatrix(['Review'], [{label: 'Page', cells: [text('Ready')]}])",
      "import {createStateMatrix, textRenderer} from 'svg-diagram/wireframe/renderers'; import {text} from 'svg-diagram/wireframe/parts'; const stateMatrix = createStateMatrix([textRenderer]);"),
      include: 'state-matrix-rules.js', bands: [], budget: {esbuild: 59500, Vite: 80000},
      exclude: [...legacy, 'dsl/wireframe.js', 'lib/wireframe.js', 'lib/wireframe-parts.js', 'bands/screens.js', 'layout-wireframes.js'], draw: true},
    {name: 'Selected wireframe dialog', source: composedSource([], "wireframe(text('Overview'), {overlays: [dialog('Review', {buttons: [btn('Send')]})]})",
      "import {createWireframe, textRenderer, btnRenderer, dialogRenderer} from 'svg-diagram/wireframe/renderers'; import {text, btn, dialog} from 'svg-diagram/wireframe/parts'; const wireframe = createWireframe([textRenderer, btnRenderer], {dialog: dialogRenderer});"),
      include: 'wireframe-renderers.js', bands: ['wireframe-basic.js'], budget: {esbuild: 77000, Vite: 104000},
      exclude: [...legacy, 'lib/wireframe.js', 'lib/wireframe-parts.js', 'bands/screens.js'], draw: true},
    {name: 'Selected wireframe toast', source: composedSource([], "wireframe(text('Overview'), {overlays: [toast('Review')]})",
      "import {createWireframe, textRenderer, toastRenderer} from 'svg-diagram/wireframe/renderers'; import {text, toast} from 'svg-diagram/wireframe/parts'; const wireframe = createWireframe([textRenderer], {toast: toastRenderer});"),
      include: 'wireframe-renderers.js', bands: ['wireframe-basic.js'], budget: {esbuild: 76000, Vite: 102500},
      exclude: [...legacy, 'lib/wireframe.js', 'lib/wireframe-parts.js', 'bands/screens.js'], draw: true},
    {name: 'Selected wireframe states', source: composedSource([], "wireframe(region('Review', {state: 'stale'}))",
      "import {createWireframe, regionRenderer, widgetStates} from 'svg-diagram/wireframe/renderers'; import {region} from 'svg-diagram/wireframe/parts'; const wireframe = createWireframe([regionRenderer], {states: widgetStates});"),
      include: 'wireframe-parts.js', bands: ['wireframe-basic.js'], budget: {esbuild: 79000, Vite: 106500},
      exclude: [...legacy, 'lib/wireframe.js', 'wireframe-insight.js', 'bands/screens.js'], draw: true},
    {name: 'Selected robot markers', source: composedSource([], "wireframe(map({markers: [{id: 'A', x: 0.5, y: 0.5, heading: 90, fov: 60, label: 'Review'}]}))",
      "import {createWireframe, mapRenderer, robotMarkers} from 'svg-diagram/wireframe/renderers'; import {map} from 'svg-diagram/wireframe/parts'; const wireframe = createWireframe([mapRenderer], {robotMarkers});"),
      include: 'wireframe-parts.js', bands: ['wireframe-basic.js'], budget: {esbuild: 79000, Vite: 106500},
      exclude: [...legacy, 'lib/wireframe.js', 'wireframe-insight.js', 'bands/screens.js'], draw: true},
    {name: 'Selected monitoring widget', source: composedSource([], "wireframe(col([text('Review'), battery(0.15)]))",
      "import {createWireframe, colRenderer, textRenderer, batteryRenderer} from 'svg-diagram/wireframe/renderers'; import {col, text, battery} from 'svg-diagram/wireframe/parts'; const wireframe = createWireframe([colRenderer, textRenderer, batteryRenderer]);"),
      include: 'wireframe-parts.js', bands: ['wireframe-basic.js'], budget: {esbuild: 76500, Vite: 103500},
      exclude: [...legacy, 'lib/wireframe.js', 'wireframe-insight.js', 'bands/screens.js'], draw: true},
    {name: 'Selected wireframe widgets', source: composedSource([], "wireframe(col([text('Review'), btn('Next')]))",
      "import {createWireframe, colRenderer, textRenderer, btnRenderer} from 'svg-diagram/wireframe/renderers'; import {col, text, btn} from 'svg-diagram/wireframe/parts'; const wireframe = createWireframe([colRenderer, textRenderer, btnRenderer]);"),
      include: 'wireframe-renderers.js', bands: ['wireframe-basic.js'], budget: {esbuild: 76500, Vite: 103000},
      exclude: [...legacy, 'lib/wireframe.js', 'lib/wireframe-parts.js', 'bands/screens.js'], draw: true},
    {name: 'Basic wireframe', source: composedSource([], "wireframe(col([text('Review'), btn('Next', {n: 2})]))",
      "import {wireframe} from 'svg-diagram/bands/wireframe/basic'; import {col, text, btn} from 'svg-diagram/wireframe/parts';"),
      include: 'bands/wireframe-basic.js', bands: ['wireframe-basic.js'], budget: {esbuild: 86000, Vite: 116500},
      exclude: [...legacy, 'lib/wireframe.js', 'lib/wireframe-parts.js', 'bands/wireframe.js', 'bands/screens.js'], draw: true},
    {name: 'Wireframe button builder', source: "export {btn} from 'svg-diagram/wireframe/parts';",
      include: 'wireframe-builders.js', exclude: [...legacy, 'wireframe-insight.js', 'wireframe.js', 'wireframe-parts.js', 'lib/core.js', 'emit-spotlight.js'],
      budget: {esbuild: 500, Vite: 500}},
    browserMeasureCase,
    {name: 'Spotlight', source: `
      import {renderBands} from 'svg-diagram/core';
      import {box} from 'svg-diagram/bands/box';
      import {spotlighter} from 'svg-diagram/spotlight';
      export const draw = () => renderBands([box({id: 'review', title: 'Review'}), box({id: 'next', title: 'Next'})],
        {spotlight: 'review', spotlighter, measure: ${measure}});
    `, include: 'spotlight-core.js', bands: ['box.js'], exclude: [...fullRenderer, ...otherSpotlightBands, 'spotlight-legend.js', 'slide-fill.js'],
      budget: {esbuild: 82700, Vite: 105200}, draw: true},
    {name: 'Slide fill', source: `
      import {renderBands} from 'svg-diagram/core';
      import {box} from 'svg-diagram/bands/box';
      import {slideFitter} from 'svg-diagram/slide-fill';
      export const draw = () => renderBands([box({title: 'Review'})],
        {slide: {maxHeight: 200, contentWidth: 640}, fill: true, fitter: slideFitter, measure: ${measure}});
    `, include: 'slide-fill.js', bands: ['box.js'], exclude: [...fullRenderer, 'spotlight-core.js', 'emit-spotlight.js', 'slide-budget.js', 'slide-budget-live.js'],
      budget: {esbuild: 81700, Vite: 103800}, draw: true},
    {name: 'Core', source: "export {renderBands} from 'svg-diagram/core';", include: 'core.js',
      exclude: [...legacy, ...otherSpotlightBands, 'emit-connect.js', 'verify-connect-geometry.js', 'layout-box-like.js', 'layout-cause-fit.js', 'layout-caption-lines.js', 'layout-decoration.js', 'status.js', 'layout-connect-gaps.js', 'layout-areas-gaps.js', 'document-findings.js', 'term-rules.js', 'toc-rules.js', 'verify-bars.js', 'axis-comparison.js', 'axis-selected.js', 'verify-image.js', 'verify-box-like.js', 'verify-shrink.js', 'verify-density.js', 'verify-cause-spacing.js', 'verify-edge-bends.js', 'verify-connect-label.js', 'verify-connect-crossings.js', 'verify-connection-graph.js', 'verify-layout-fit.js', 'verify-wireframe-callouts.js', 'verify-caption.js', 'verify-grid.js', 'table-number-rules.js', 'verify-flowchart.js', 'verify-concentric.js', 'box.js', 'gantt.js', 'emit-boxes.js', 'emit-gantt.js', 'layout-metrics.js'], budget: {esbuild: 39800, Vite: 53100}},
    {name: 'Document findings', source: `
      import {renderBands} from 'svg-diagram/core';
      import {box} from 'svg-diagram/bands/box';
      import {documentAcceptHint, documentFindings} from 'svg-diagram/verify/document';
      export const draw = () => renderBands([box({title: 'Review', body: '確認 ✅'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        width: 720, maxWidth: 500, diagramFindings: documentFindings, diagramAcceptHint: documentAcceptHint,
      });
    `, include: 'document-findings.js', bands: ['box.js'], exclude: [...legacy, 'term-rules.js', 'layout-connect.js'],
      budget: {esbuild: 89000, Vite: 113000}, draw: true},
    {name: 'Box', source: bandSource('box'), include: 'bands/box.js',
      exclude: [...legacy, ...otherSpotlightBands, 'document-findings.js', 'legend-notation.js', 'verify-gray-tones.js', 'emit-boxes.js', 'emit-grid.js', 'emit-row.js', 'dsl/node.js', 'dsl/stat.js', 'emit-connect.js', 'reveal-warnings.js', 'reveal-handlers.js', 'reveal-row.js', 'verify-connect-geometry.js', 'verify-connect-label.js', 'verify-connect-crossings.js', 'verify-connection-graph.js', 'verify-layout-fit.js', 'verify-wireframe-callouts.js', 'gantt.js', 'emit-gantt.js', 'timeline.js', 'people.js', 'emit-fta.js'], budget: {esbuild: 76700, Vite: 97400}, draw: true},
    {name: 'Node and stat', source: composedSource([], "node({icon: 'check', label: 'Review'}), stat(12, 'Count', {source: 'Report'})",
      "import {icon, node, stat} from 'svg-diagram/bands/box'; icon.use({version: 1, icons: {check: {d: 'M2 2h20v20H2z', vb: [0, 0, 24], from: 'file:check.svg', license: 'local'}}});"),
      include: 'dsl/stat.js', budget: {esbuild: 83300, Vite: 105700}, bands: ['box.js'],
      exclude: [...legacy, 'layout-row.js', 'layout-grid.js', 'layout-connect.js', 'layout-areas.js'], draw: true},
    {name: 'Gantt', source: bandSource('gantt'), include: 'bands/gantt.js',
      exclude: [...legacy, 'emit-connect.js', 'verify-connect-geometry.js', 'layout-box-like.js', 'layout-cause-fit.js', 'box.js', 'emit-boxes.js', 'layout-connect.js', 'timeline.js', 'emit-timeline.js', 'emit-figures.js', 'charts.js'], budget: {esbuild: 53000, Vite: 70500}, draw: true},
    {name: 'Row', source: composedSource(['box', 'row'], "row([box({title: 'Review'}), box({title: 'Next'})], {arrows: 'between'})"),
      include: 'bands/row.js', budget: {esbuild: 91100, Vite: 115900}, bands: ['box.js', 'row.js'], exclude: [...legacy, 'dsl/row.js', 'dsl/group.js', 'dsl/container-children.js', 'loop-back.js', 'loop-back-connectors.js', 'dsl/containers.js', 'dsl/areas.js', 'dsl/grid.js', 'emit-boxes.js', 'emit-grid.js', 'steps.js', 'emit-connect.js', 'verify-connect-geometry.js', 'layout-cause-fit.js', 'layout-caption-lines.js', 'layout-decoration.js', 'status.js', 'layout-connect-gaps.js', 'layout-areas-gaps.js', 'layout-grid.js', 'layout-connect.js', 'layout-group.js', 'layout-group-row.js', 'layout-areas.js', 'gantt.js'], draw: true},
    {name: 'Steps', source: composedSource([], "steps([{title: 'Review'}, {title: 'Approve'}], {numbered: true, focus: 2})",
      "import {steps} from 'svg-diagram/bands/row';"),
      include: 'steps.js', budget: {esbuild: 94300, Vite: 119700}, bands: ['box.js', 'row.js'],
      exclude: [...legacy, 'dsl/row.js', 'dsl/group.js', 'dsl/container-children.js', 'loop-back.js', 'loop-back-connectors.js', 'layout-connect.js', 'bands/connect.js', 'layout-grid.js', 'layout-group-row.js', 'layout-areas.js'], draw: true},
    {name: 'Grid', source: composedSource(['box', 'grid'], "grid([box({title: 'Review'}), box({title: 'Next'})], {cols: 2})"),
      include: 'bands/grid.js', budget: {esbuild: 85200, Vite: 106100}, bands: ['box.js', 'grid.js'], exclude: [...legacy, 'dsl/containers.js', 'dsl/row.js', 'dsl/areas.js', 'dsl/group.js', 'dsl/container-children.js', 'emit-boxes.js', 'emit-row.js', 'emit-connect.js', 'verify-connect-geometry.js', 'layout-cause-fit.js', 'layout-caption-lines.js', 'layout-decoration.js', 'status.js', 'layout-connect-gaps.js', 'layout-areas-gaps.js', 'layout-row.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Connect', source: composedSource(['box', 'connect'], "connect('a:bottom', 'b:top'), connect('b:bottom', 'c:top'), connect('d:bottom', 'e:top'), box({id: 'a', title: 'Review'}), ...['b', 'c', 'd', 'e', 'f'].map(id => box({id, title: id}))"),
      include: 'layout-connect-gaps.js', budget: {esbuild: 115200, Vite: 146900}, bands: ['box.js', 'connect.js'], exclude: [...legacy, 'dsl/bracket.js', 'dsl/callout.js', 'dsl/branch.js', 'loop-back.js', 'loop-back-options.js', 'loop-back-source.js', 'layout-areas-gaps.js', 'layout-row.js', 'layout-grid.js', 'gantt.js'], draw: true},
    ...([
      ['bracket', "bracket('a:left', 'b:right', {label: '範囲'})"],
      ['callout', "callout('a', {text: '注意', side: 'above'})"],
      ['branch', "...branch('a:bottom', [{to: 'b:top', label: '次へ'}])"],
    ] as const).map(([name, sample]) => ({
      name, source: composedSource(name === 'bracket' ? ['box'] : ['box', 'spacer'], `${name === 'callout' ? 'spacer(64), ' : ''}box({id: 'a', title: 'Review'}), ${name === 'branch' ? 'spacer(64), ' : ''}box({id: 'b', title: 'Done'}), ${sample}`,
        `import {${name}} from 'svg-diagram/bands/connect';`),
      include: `dsl/${name}.js`, budget: {esbuild: 116000, Vite: 145000}, bands: name === 'bracket' ? ['box.js', 'connect.js'] : ['box.js', 'connect.js', 'spacer.js'],
      exclude: [...legacy, 'dsl/connect.js', ...['bracket', 'callout', 'branch'].filter(other => other !== name).map(other => `dsl/${other}.js`)],
      draw: true,
    })),
    {name: 'Row loop-back', source: `
      import {renderBands} from 'svg-diagram/core';
      import {box} from 'svg-diagram/bands/box';
      import {row} from 'svg-diagram/bands/row';
      import {connectDefinition} from 'svg-diagram/bands/connect';
      export const draw = () => renderBands([
        row([box({title: 'Review'}), box({title: 'Next'})], {loopBack: {from: 2, to: 1, label: 'Retry'}})
      ], {connectors: connectDefinition, measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size})});
    `, include: 'bands/row.js', budget: {esbuild: 128400, Vite: 163300}, bands: ['box.js', 'connect.js', 'row.js'], exclude: [...legacy, 'dsl/row.js', 'dsl/group.js', 'dsl/container-children.js', 'loop-back.js', 'layout-grid.js', 'gantt.js'], draw: true},
    {name: 'Image', source: composedSource(['image'], "image('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', {alt: 'Picture', width: 240, labels: [{text: 'Review', at: [0.3, 0.5]}]})"),
      include: 'bands/image.js', budget: {esbuild: 68000, Vite: 91000}, exclude: [...legacy, 'verify-bars.js', 'dsl/io.js', 'image-file.js', 'charts.js', 'layout-connect.js'], draw: true},
    {name: 'Spacer', source: composedSource(['spacer'], 'spacer(24)'),
      include: 'bands/spacer.js', budget: {esbuild: 40300, Vite: 53400}, bands: ['spacer.js'],
      exclude: [...legacy, 'dsl/containers.js', 'dsl/row.js', 'dsl/grid.js', 'dsl/areas.js', 'bands/caption.js', 'bands/box.js', 'layout-box-like.js', 'emit-boxes.js', 'layout-connect.js'], draw: true},
    {name: 'Caption and spacer', source: composedSource(['caption', 'spacer'], "caption('Review', {mono: true}), spacer(24), caption('Next')"),
      include: 'bands/caption.js', budget: {esbuild: 62000, Vite: 82000}, bands: ['caption.js', 'spacer.js'], exclude: [...legacy, 'emit-boxes.js', 'emit-grid.js', 'emit-row.js', 'layout-row.js', 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Group', source: composedSource(['box', 'group'], "group(box({title: 'Review'}), {title: 'Plan'})"),
      include: 'bands/group.js', budget: {esbuild: 89500, Vite: 114000}, bands: ['box.js', 'caption.js', 'group.js'], exclude: [...legacy, 'emit-boxes.js', 'emit-grid.js', 'emit-row.js', 'layout-row.js', 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Group row', source: composedSource(['box', 'group', 'groupRow'], "groupRow([group(box({title: 'Review'})), box({title: 'Next'})])"),
      include: 'bands/group-row.js', budget: {esbuild: 99500, Vite: 126500}, bands: ['box.js', 'caption.js', 'group-row.js', 'group.js'], exclude: [...legacy, 'dsl/row.js', 'dsl/box-row.js', 'loop-back-options.js', 'loop-back-connectors.js', 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Areas', source: composedSource(['areas', 'box'], "areas(['wide wide', 'left right'], {wide: box({title: 'Review'}), left: box({title: 'Left'}), right: box({title: 'Right'})})"),
      include: 'layout-areas-gaps.js', budget: {esbuild: 104100, Vite: 132200}, bands: ['areas.js', 'box.js', 'caption.js', 'group.js'], exclude: [...legacy, 'dsl/containers.js', 'dsl/row.js', 'dsl/grid.js', 'layout-connect-gaps.js', 'layout-group-row.js', 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Banner', source: composedSource(['banner'], "banner({headline: 'Review', stamp: 'Draft'})"),
      include: 'emit-banner.js', budget: {esbuild: 61000, Vite: 78000}, bands: ['banner.js'],
      exclude: [...legacy, 'emit-box.js', 'emit-boxes.js', 'emit-caption.js', 'emit-raw.js', 'layout-connect.js'], draw: true},
    {name: 'Raw', source: composedSource(['raw'], `raw({h: 40, draw: ({x, y, color}) =>
      '<text x="' + x + '" y="' + (y + 20) + '" fill="' + color('accent') + '">Review</text>'})`),
      include: 'dsl/raw.js', budget: {esbuild: 40900, Vite: 54600}, bands: ['raw.js'],
      exclude: [...legacy, 'dsl/text-bands.js', 'dsl/banner.js', 'emit-boxes.js', 'emit-banner.js', 'emit-box.js', 'layout-box-like.js'], draw: true},
    {name: 'Banner and raw', source: composedSource(['banner', 'raw'], `banner({headline: 'Review'}), raw({h: 32, draw: ({x, y}) => '<rect x="' + x + '" y="' + y + '" width="24" height="24"/>'})`),
      include: 'bands/banner.js', budget: {esbuild: 63500, Vite: 85500}, bands: ['banner.js', 'raw.js'], exclude: [...legacy, 'emit-boxes.js', 'emit-status.js', 'layout-areas.js', 'layout-group.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Curve', source: composedSource(['curve'], "curve([{y: 0.3, dropLine: true}, {y: 0.8}], {xLabel: 'Review'})"),
      include: 'bands/curve.js', budget: {esbuild: 57500, Vite: 77000}, exclude: [...legacy, 'emit-boxes.js', 'emit-pyramid.js', 'layout-pyramid.js', 'layout-connect.js', 'flow-shapes.js', 'gantt.js'], draw: true},
    {name: 'Pyramid', source: composedSource(['pyramid'], "pyramid(['Review', 'Plan'])"),
      include: 'bands/pyramid.js', budget: {esbuild: 57500, Vite: 77500}, exclude: [...legacy, 'emit-boxes.js', 'emit-curve.js', 'layout-curve.js', 'layout-connect.js', 'flow-shapes.js', 'gantt.js'], draw: true},
    ...flowSamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample),
      budget: name === 'concentric' ? {esbuild: 84000, Vite: 115000} : {esbuild: 83000, Vite: 114000},
      include: `bands/${name === 'valueChain' ? 'value-chain' : name}.js`,
      exclude: [...legacy, 'flow-shapes.js', 'dsl/flow.js', 'loop-back.js', 'loop-back-connectors.js',
        ...flowSamples.filter(([other]) => other !== name).map(([other]) => `flow-${other === 'valueChain' ? 'value-chain' : other}.js`), 'emit-figures.js', 'layout-connect.js', 'layout-pyramid.js', 'gantt.js', 'quadrant.js', 'verify-quadrant.js', 'verify-flowchart.js', 'verify-gantt.js', 'verify-comic-rects.js', 'verify-caption.js', 'wordart.js',
        ...(name === 'funnel' ? [] : ['verify-funnel.js']), ...(name === 'concentric' ? [] : ['verify-concentric.js'])], draw: true,
    })),
    ...quantitySamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample),
      budget: {esbuild: name === 'dots' ? 64000 : 63500, Vite: name === 'dots' ? 87500 : 86000},
      include: `bands/${name}.js`, exclude: [...legacy, 'timeline.js', 'emit-boxes.js', 'dsl/people-dots.js', ...(name === 'dots' ? ['emit-people.js', 'lib/people.js', 'dsl/people.js'] : ['emit-dots.js', 'layout-dots.js', 'dsl/dots.js']), 'layout-connect.js', 'gantt.js'], draw: true,
    })),
    {name: 'Timeline', source: composedSource(['timeline'], "timeline({unit: 'ms', from: 0, to: 100, events: [{at: 25, label: 'Review'}]})"),
      include: 'bands/timeline.js', budget: {esbuild: 72000, Vite: 96500}, exclude: [...legacy, 'emit-figures.js', 'people.js', 'gantt.js', 'emit-gantt.js', 'layout-connect.js'], draw: true},
    {name: 'Status', source: composedSource(['status'], "status('draft', 'Review')"),
      include: 'bands/status.js', budget: {esbuild: 56500, Vite: 76000}, exclude: [...legacy, 'emit-boxes.js', 'emit-raw.js', 'wordart.js', 'flow-shapes.js', 'gantt.js', 'layout-connect.js'], draw: true},
    {name: 'Wordart', source: composedSource(['wordart'], "wordart('Review', {style: 'outline', size: 40})"),
      include: 'bands/wordart.js', budget: {esbuild: 75500, Vite: 100500}, exclude: [...legacy, 'flow-shapes.js', 'gantt.js', 'layout-connect.js'], draw: true},
    {name: 'Legend', source: composedSource(['legend'], "legend([{label: 'Review', role: 'root'}, {label: 'Gate', ftaGate: 'and'}, {label: 'Link', weight: 'strong'}])"),
      include: 'bands/legend.js', budget: {esbuild: 63500, Vite: 84500}, exclude: [...legacy, 'emit-boxes.js', 'emit-swimlane.js', 'toc.js', 'fta.js', 'emit-fta.js', 'gantt.js', 'layout-connect.js'], draw: true},
    {name: 'Quadrant', source: composedSource(['quadrant'], "quadrant.preset('bcg', {items: [{label: 'Review', cell: [0, 0]}]})"),
      include: 'bands/quadrant.js', budget: {esbuild: 101000, Vite: 129000}, exclude: [...legacy, 'emit-figures.js', 'flow-shapes.js', 'plane.js', 'gantt.js', 'layout-connect.js', 'dsl/figures.js'], draw: true},
    {name: 'Plane', source: composedSource(['plane'], "plane({x: {max: 20, step: 10}, y: {max: 10, step: 5}, points: [{at: [10, 5], label: 'Review', reveal: 2}]})"),
      include: 'bands/plane.js', budget: {esbuild: 78000, Vite: 104000}, exclude: [...legacy, 'emit-figures.js', 'quadrant.js', 'flow-shapes.js', 'gantt.js', 'reveal-handlers.js', 'layout-connect.js'], draw: true},
    {name: 'Bars', source: composedSource(['bars'], "bars([{id: 'old', label: 'Draft', value: 4}, {label: 'Review', value: 6, reveal: 2, replaces: 'old'}])"),
      include: 'bands/bars.js', budget: {esbuild: 85500, Vite: 113500}, exclude: [...legacy, 'emit-figures.js', 'axis-rules.js', 'charts-waterfall.js', 'charts-stacked.js', 'charts-tornado.js', 'verify-image.js', 'plane.js', 'qc-plane.js', 'qc.js', 'gantt.js', 'reveal-handlers.js'], draw: true},
    ...tableSamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample), include: `bands/${name}.js`,
      budget: {esbuild: name === 'table' ? 82500 : 77000, Vite: name === 'table' ? 107500 : 102000},
      exclude: [...legacy, 'layout-connect.js', 'gantt.js', 'wireframe.js', 'lane-order.js', 'emit-tables.js', 'emit-wireframe.js', 'seq-table.js', 'dsl/sequence-table-swimlane.js', 'dsl/swimlane.js', ...(name === 'table' ? ['dsl/sequence.js', 'emit-sequence.js', 'layout-sequence.js'] : ['dsl/table.js', 'emit-table.js', 'layout-table.js'])], draw: true,
    })),
    ...screenSamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample, `import {wf} from 'svg-diagram/bands/${name}';`), include: `bands/${name}.js`,
      budget: {esbuild: 110500, Vite: 152000},
      exclude: [...legacy, 'layout-connect.js', 'gantt.js', 'seq-table.js', 'flow-shapes.js', 'emit-tables.js', 'emit-table.js', 'emit-sequence.js'], draw: true,
    })),
    {name: 'Fault tree', source: composedSource([], "faultTree({label: 'Review', gate: 'or', children: [{label: 'Power', kind: 'basic'}, {label: 'Network', kind: 'basic'}]})", "import {faultTree} from 'svg-diagram/bands/fta';"),
      include: 'bands/fta.js', budget: {esbuild: 88500, Vite: 115500}, exclude: [...legacy, 'bowtie.js', 'emit-bowtie.js', 'layout-connect.js', 'dsl/diagrams.js'], draw: true},
    {name: 'Bowtie', source: composedSource(['bowtie'], "bowtie({top: 'Review', threats: [{label: 'Failure'}], consequences: [{label: 'Delay'}]})"),
      include: 'bands/bowtie.js', budget: {esbuild: 76500, Vite: 100000}, exclude: [...legacy, 'fta.js', 'emit-fta.js', 'layout-connect.js', 'dsl/diagrams.js'], draw: true},
    {name: 'Cloud', source: composedSource(['cloud'], "cloud({a: 'Goal', b: 'Quality', c: 'Time', d: 'Test', d2: 'Ship'}, {assumptions: [{on: 'bd', text: 'Review'}]})"),
      include: 'bands/cloud.js', budget: {esbuild: 67500, Vite: 89500}, exclude: [...legacy, 'emit-figures.js', 'toc.js', 'layered-route.js', 'cause-hop.js', 'layout-connect.js', 'dsl/diagrams.js'], draw: true},
    {name: 'Classes', source: composedSource([], "classDiagram([{id: 'a', name: 'Review'}, {id: 'b'}], [{from: 'b', to: 'a', kind: 'inherit'}])", "import {classDiagram} from 'svg-diagram/bands/classes';"),
      include: 'bands/classes.js', budget: {esbuild: 142000, Vite: 200000}, exclude: [...legacy, 'emit-figures.js', 'bpmn.js', 'bpmn-vertical.js', 'toc.js', 'dsl/diagrams.js', 'layout-connect.js'], draw: true},
    {name: 'BPMN', source: composedSource(['bpmn'], "bpmn([{id: 'work', label: 'Work'}], [{id: 'a', lane: 'work', label: 'Review'}], [])"),
      include: 'bands/bpmn.js', budget: {esbuild: 121000, Vite: 165000}, exclude: [...legacy, 'emit-figures.js', 'classes.js', 'verify-density.js', 'toc.js', 'dsl/diagrams.js', 'layout-connect.js'], draw: true},
    {name: 'States', source: composedSource([], "stateDiagram([{id: 'a', label: 'Review'}, {id: 'b', label: 'Done'}], [{from: 'a', to: 'b'}])", "import {stateDiagram} from 'svg-diagram/bands/states';"),
      include: 'bands/states.js', budget: {esbuild: 160000, Vite: 222000}, exclude: [...legacy, 'emit-figures.js', 'classes.js', 'bpmn.js', 'verify-cause-spacing.js', 'verify-shrink.js', 'toc.js', 'dsl/diagrams.js', 'layout-connect.js'], draw: true},
    {name: 'Tree', source: composedSource(['tree'], "tree({label: 'Review', children: [{label: 'Plan'}, {label: 'Decide'}]})"),
      include: 'bands/tree.js', budget: {esbuild: 90000, Vite: 120000}, exclude: [...legacy, 'emit-figures.js', 'states.js', 'toc.js', 'layout-connect.js', 'dsl/diagrams.js', 'layout-row.js', 'layout-grid.js'], draw: true},
    {name: 'Cause', source: composedSource([], "causeTree([{id: 'a', label: 'Review'}, {id: 'b', label: 'Done'}], [{from: 'a', to: 'b'}], {tree: 'crt'})", "import {causeTree} from 'svg-diagram/bands/cause';"),
      include: 'layout-cause-fit.js', bands: ['cause.js'], budget: {esbuild: 177000, Vite: 238000}, exclude: [...legacy, 'emit-figures.js', 'cloud.js', 'states.js', 'classes.js', 'dsl/diagrams.js', 'layout-connect.js', 'rca-rules.js'], draw: true},
    {name: 'Swimlane', source: composedSource(['swimlane'], "...swimlane([{id: 'work', label: 'Work'}], [{id: 'a', lane: 'work', title: 'Review'}])"),
      include: 'bands/swimlane.js', budget: {esbuild: 101500, Vite: 130000}, exclude: [...legacy, 'dsl/sequence-table-swimlane.js', 'dsl/sequence.js', 'dsl/table.js', 'emit-boxes.js', 'emit-legend.js', 'layout-connect.js', 'bands/connect.js', 'seq-table.js', 'wireframe.js', 'layout-row.js'], draw: true,
      bands: ['box.js', 'swimlane.js']},
    {name: 'Radar', source: composedSource(['radar'], "radar(['A', 'B', 'C'], [{label: 'Review', values: [3, 4, 5]}], {max: 5})"),
      include: 'bands/radar.js', budget: {esbuild: 97000, Vite: 120000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-waterfall.js', 'charts-sankey.js', 'semnet.js', 'layout-connect.js'], draw: true},
    {name: 'Waterfall', source: composedSource(['waterfall'], "waterfall([{label: 'Review', value: 100}, {label: 'Gain', value: 25}])"),
      include: 'bands/waterfall.js', budget: {esbuild: 100000, Vite: 123000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'axis-rules.js', 'charts-stacked.js', 'charts-tornado.js', 'verify-edge-bends.js', 'lib/charts.js', 'charts-radar.js', 'charts-sankey.js', 'semnet.js', 'layout-connect.js'], draw: true},
    {name: 'Sankey', source: composedSource(['sankey'], "sankey(['Review', 'Done'], [{from: 'Review', to: 'Done', value: 5}])"),
      include: 'bands/sankey.js', budget: {esbuild: 105000, Vite: 127000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-heatmap.js', 'charts-radar.js', 'charts-waterfall.js'], draw: true},
    {name: 'Heatmap', source: composedSource(['heatmap'], "heatmap(['Review', 'Done'], ['A', 'B'], [[1, null], [2, 5]])"),
      include: 'bands/heatmap.js', budget: {esbuild: 96000, Vite: 117000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-sankey.js', 'charts-radar.js', 'charts-waterfall.js'], draw: true},
    {name: 'Stacked', source: composedSource([], "stackedBars([{label: 'Review', parts: [{label: 'Plan', value: 4}]}])", "import {stackedBars} from 'svg-diagram/bands/stacked';"),
      include: 'bands/stacked.js', budget: {esbuild: 98000, Vite: 121000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-treemap.js', 'charts-sankey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Treemap', source: composedSource(['treemap'], "treemap({label: 'Review', value: 5})"),
      include: 'bands/treemap.js', budget: {esbuild: 96000, Vite: 118000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-stacked.js', 'charts-sankey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Harvey', source: composedSource(['harvey'], "harvey(['Review'], ['Plan'], [[4]])"),
      include: 'bands/harvey.js', budget: {esbuild: 96000, Vite: 118000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-tornado.js', 'charts-butterfly.js', 'charts-bubble.js', 'charts-heatmap.js'], draw: true},
    {name: 'Bubble', source: composedSource(['bubble'], "bubble([{label: 'Review', x: 2, y: 3, size: 5}], {x: {min: 0, max: 4}, y: {min: 0, max: 6}})"),
      include: 'bands/bubble.js', budget: {esbuild: 98000, Vite: 121000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-tornado.js', 'charts-butterfly.js', 'charts-harvey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Butterfly', source: composedSource(['butterfly'], "butterfly([{label: 'Review', left: 4, right: 5}], {leftLabel: 'Left', rightLabel: 'Right'})"),
      include: 'bands/butterfly.js', budget: {esbuild: 93000, Vite: 114000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-tornado.js', 'charts-bubble.js', 'charts-harvey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Tornado', source: composedSource(['tornado'], "tornado([{label: 'Review', low: 3, high: 9}], {base: 5})"),
      include: 'bands/tornado.js', budget: {esbuild: 97000, Vite: 118500}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'charts-butterfly.js', 'charts-bubble.js', 'charts-harvey.js', 'charts-heatmap.js'], draw: true},
    {name: 'clustermap', source: composedSource([], "clustermap(['Review', 'Next'], ['A', 'B'], [[1, 3], [4, 2]])", "import {clustermap} from 'svg-diagram/bands/clustermap';"),
      include: 'bands/clustermap.js', budget: {esbuild: 78000, Vite: 98000}, exclude: [...legacy, 'dsl/charts-stats.js', 'charts-dsl.js', 'dsl/facet.js', 'lib/charts.js', 'charts-cat.js', 'charts-dist.js', 'charts-multi.js', 'charts-reg.js'], draw: true},
    {name: 'regplot', source: composedSource([], "regplot({x: [1, 2, 3, 4, 5], y: [2, 5, 5, 7, 9]}, {xLabel: 'Review'})", "import {regplot} from 'svg-diagram/bands/regplot';"),
      include: 'bands/regplot.js', budget: {esbuild: 82000, Vite: 105000}, exclude: [...legacy, 'dsl/charts-stats.js', 'charts-dsl.js', 'dsl/facet.js', 'lib/charts.js', 'charts-cat.js', 'charts-dist.js', 'charts-multi.js', 'charts-cluster.js'], draw: true},
    {name: 'multiplot', source: composedSource([], "hist2d({x: [1, 2, 3, 4], y: [1, 3, 4, 2]}, {xLabel: 'Review'})", "import {hist2d} from 'svg-diagram/bands/multiplot';"),
      include: 'bands/multiplot.js', budget: {esbuild: 88000, Vite: 113000}, exclude: [...legacy, 'dsl/charts-stats.js', 'charts-dsl.js', 'dsl/facet.js', 'lib/charts.js', 'charts-cat.js', 'charts-dist.js', 'charts-reg.js', 'charts-cluster.js'], draw: true},
    {name: 'distplot', source: composedSource([], "histplot([1, 2, 3, 4, 5], {label: 'Review'})", "import {histplot} from 'svg-diagram/bands/distplot';"),
      include: 'bands/distplot.js', budget: {esbuild: 83000, Vite: 104000}, exclude: [...legacy, 'dsl/charts-stats.js', 'charts-dsl.js', 'dsl/facet.js', 'lib/charts.js', 'charts-cat.js', 'charts-multi.js', 'charts-reg.js', 'charts-cluster.js'], draw: true},
    {name: 'catplot', source: composedSource([], "catplot({Review: [1, 2, 3, 4, 5]})", "import {catplot} from 'svg-diagram/bands/catplot';"),
      include: 'bands/catplot.js', budget: {esbuild: 87000, Vite: 111000}, exclude: [...legacy, 'dsl/charts-stats.js', 'charts-dsl.js', 'dsl/facet.js', 'lib/charts.js', 'charts-dist.js', 'charts-multi.js', 'charts-reg.js', 'charts-cluster.js'], draw: true},
    {name: 'dependency', source: composedSource([], "dependencyNetwork([{id: 'a', label: 'Review'}, {id: 'b', label: 'Next'}], [{from: 'a', to: 'b', type: 'uses'}])", "import {dependencyNetwork} from 'svg-diagram/bands/dependency';"),
      include: 'bands/dependency.js', budget: {esbuild: 161000, Vite: 215000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'semnet.js', 'semnet-analysis.js', 'semnet-dsl.js', 'semnet-causal-loops.js', 'semnet-critical-path.js', 'charts-combo.js', 'charts-compare.js', 'semnet-pert.js', 'semnet-causal.js'], draw: true},
    {name: 'causal', source: composedSource([], "causalLoop([{id: 'a', label: 'Review'}, {id: 'b', label: 'Next'}], [{from: 'a', to: 'b', polarity: '+'}])", "import {causalLoop} from 'svg-diagram/bands/causal';"),
      include: 'bands/causal.js', budget: {esbuild: 172000, Vite: 231000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'semnet.js', 'semnet-analysis.js', 'semnet-dsl.js', 'semnet-critical-path.js', 'charts-combo.js', 'charts-compare.js', 'semnet-pert.js', 'semnet-dependency.js'], draw: true},
    {name: 'pert', source: composedSource([], "pert([{id: 'a', label: 'Review', duration: 2}])", "import {pert} from 'svg-diagram/bands/pert';"),
      include: 'bands/pert.js', budget: {esbuild: 161000, Vite: 215000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'semnet.js', 'semnet-analysis.js', 'semnet-dsl.js', 'semnet-causal-loops.js', 'charts-combo.js', 'charts-compare.js', 'semnet-causal.js', 'semnet-dependency.js'], draw: true},
    {name: 'compare', source: composedSource([], "compare(['Review'], ['Plan'], [[['○', 'Ready']]])", "import {compare} from 'svg-diagram/bands/compare';"),
      include: 'bands/compare.js', budget: {esbuild: 94000, Vite: 115000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'semnet.js', 'charts-combo.js', 'semnet-pert.js', 'semnet-causal.js', 'semnet-dependency.js'], draw: true},
    {name: 'combo', source: composedSource([], "combo(['Review', 'Next'], [{label: 'Plan', type: 'bar', values: [4, 5]}])", "import {combo} from 'svg-diagram/bands/combo';"),
      include: 'bands/combo.js', budget: {esbuild: 102000, Vite: 125000}, exclude: [...legacy, 'dsl/charts.js', 'charts-dsl.js', 'lib/charts.js', 'semnet.js', 'charts-compare.js', 'semnet-pert.js', 'semnet-causal.js', 'semnet-dependency.js'], draw: true},
  ];
  const pictureFile = path.join(consumer, 'picture.gif');
  const imageSource = composedSource([], `imageFile(${JSON.stringify(pictureFile)}, {alt: 'Picture', width: 240})`,
    "import {imageFile} from 'svg-diagram/bands/image/node';");
  const mathSource = composedSource(['math'], "math('x^2', {alt: 'Square'})");
  const nodeSpecSource = `
    import {renderSpec} from 'svg-diagram/spec/selective/node';
    import {tablePart} from 'svg-diagram/spec/parts/table';
    export const draw = () => renderSpec(${edgeTable}, {parts: [tablePart]});
  `;
  const diagramFile = path.join(consumer, 'plan.diagram.ts');
  const pageFile = path.join(consumer, 'plan.md');
  const markdown = JSON.stringify('![Plan](./plan.diagram.ts)\n');
  const markdownOptions = `{root: ${JSON.stringify(consumer)}, baseDir: ${JSON.stringify(consumer)}}`;
  const nodeDrawCases = [
    {name: '.', source: `
      import {box, diagram, renderDiagram} from 'svg-diagram';
      export const draw = () => renderDiagram(diagram({theme: 'blue'}).add(box({title: 'Review'})), {name: 'plan.svg', budget: 'cacheOnly'});
    `, budget: {esbuild: 1215000, Vite: 1158000}, check: reviewDrawing},
    {name: './render', source: `
      import {renderSource} from 'svg-diagram/render';
      export const draw = () => renderSource(${JSON.stringify(diagramFile)});
    `, budget: {esbuild: 949000, Vite: 892000},
    check: (result: {ok: boolean; svg: string; problems: string[]}, label: string) => {
      assert.deepEqual(result.problems, [], label);
      assert.equal(result.ok, true, label);
      reviewSvg(result.svg, label);
    }},
    {name: './measure/node', source: `
      import {fontMeasurer} from 'svg-diagram/measure/node';
      import {renderBands} from 'svg-diagram/core';
      import {box} from 'svg-diagram/bands/box';
      export const draw = () => renderBands([box({title: 'Review'})], {measure: fontMeasurer()});
    `, budget: {esbuild: 80000, Vite: 76000}, check: reviewDrawing},
    {name: './png', source: `
      import {svgToPng} from 'svg-diagram/png';
      export const draw = () => svgToPng(${JSON.stringify(tinySvg)});
    `, budget: {esbuild: 24000, Vite: 24000},
    check: (result: {png: Uint8Array; width: number; height: number}, label: string) => {
      assert.deepEqual([...result.png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10], label);
      assert.deepEqual([result.width, result.height], [8, 8], label);
    }},
    {name: './markdown', source: `
      import {expandMarkdown} from 'svg-diagram/markdown';
      export const draw = () => expandMarkdown(${markdown}, {
        file: ${JSON.stringify(pageFile)}, root: ${JSON.stringify(consumer)}, mode: 'inline',
      });
    `, budget: {esbuild: 956000, Vite: 899000},
    check: (result: {markdown: string; problems: string[]}, label: string) => {
      assert.deepEqual(result.problems, [], label);
      reviewSvg(result.markdown, label);
    }},
    {name: './markdown-it', source: `
      import MarkdownIt from 'markdown-it';
      import svgDiagram from 'svg-diagram/markdown-it';
      export const draw = () => new MarkdownIt().use(svgDiagram, ${markdownOptions}).render(${markdown});
    `, budget: {esbuild: 6400, Vite: 6400}, check: reviewSvg},
    {name: './remark', source: `
      import {unified} from 'unified';
      import remarkParse from 'remark-parse';
      import remarkRehype from 'remark-rehype';
      import rehypeStringify from 'rehype-stringify';
      import svgDiagram from 'svg-diagram/remark';
      export const draw = async () => String(await unified()
        .use(remarkParse).use(svgDiagram, ${markdownOptions}).use(remarkRehype).use(rehypeStringify).process(${markdown}));
    `, budget: {esbuild: 957000, Vite: 900000}, check: reviewSvg},
    {name: './vitepress', source: `
      import MarkdownIt from 'markdown-it';
      import svgDiagram from 'svg-diagram/vitepress';
      export const draw = () => {
        const md = new MarkdownIt();
        svgDiagram(${markdownOptions})(md);
        return md.render(${markdown}, {path: ${JSON.stringify(pageFile)}, includes: []});
      };
    `, budget: {esbuild: 6500, Vite: 6500},
    check: (html: string, label: string) => {
      const encoded = /class="svg-diagram-vue" v-html="([^"]+)"/.exec(html)?.[1];
      assert.ok(encoded, label);
      reviewSvg(JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&amp;', '&')), label);
    }},
  ];

  // Read the keys from the fixtures independently of package.json. Shared entries are classified
  // under browser drawing when they also appear as dependencies in Node drawing fixtures.
  const browserEntries = new Set(cases.filter(fixture => fixture.draw || 'check' in fixture)
    .flatMap(fixture => importedEntries(fixture.source)));
  const coverage = {
    'ブラウザ描画': browserEntries,
    'Node.js 描画': [...nodeDrawCases.map(fixture => fixture.source), nodeSpecSource, imageSource, mathSource].flatMap(importedEntries)
      .filter(key => !browserEntries.has(key)),
    'バンドルと予算': importedEntries(browserMeasureCase.source).filter(key => !browserEntries.has(key)),
    '型のみ': ['./plugin'],
    'JSON': ['./schema/*.json'],
  };
  const classified = new Map<string, string>();
  for (const [category, keys] of Object.entries(coverage)) {
    for (const key of new Set(keys)) {
      if (classified.has(key)) {
        throw new ExportClassificationError(`${key} の検査分類が重複しています（${classified.get(key)}、${category}）。分類を一つにしてください`);
      }
      classified.set(key, category);
    }
  }
  const missing = Object.keys(published).filter(key => !classified.has(key));
  const stale = [...classified.keys()].filter(key => !Object.hasOwn(published, key));
  const classificationProblems = [];
  if (missing.length) classificationProblems.push(`package.json の exports に検査分類がありません。分類を追加してください: ${missing.join(', ')}`);
  if (stale.length) classificationProblems.push(`package.json の exports に存在しない検査分類があります。分類を見直してください: ${stale.join(', ')}`);
  if (classificationProblems.length) throw new ExportClassificationError(classificationProblems.join('。'));

  const publicEntries = Object.entries(published).flatMap(([name, target]) =>
    typeof target === 'string' ? [] : [[name, target] as const]);
  const outputAdapters = publicEntries.filter(([name]) => /^\.\/(?:html|pptx)\/bands\//.test(name));
  const testedOutputAdapters = {esbuild: new Set<string>(), Vite: new Set<string>()};
  const testedBandModules = {esbuild: new Set<string>(), Vite: new Set<string>()};
  function bandModules(files: readonly string[]) {
    return files.flatMap(file => /(?:^|\/)bands\/([^/]+\.js)$/.exec(file.replaceAll('\\', '/'))?.[1] ?? []).sort();
  }

  function recordBandModules(bundler: keyof typeof testedBandModules, files: readonly string[]) {
    for (const file of bandModules(files)) testedBandModules[bundler].add(file);
  }

  for (const testCase of cases) {
    const {name, source, include, exclude, budget, draw, bands} = testCase;
    if (draw || 'check' in testCase) assert.ok(budget, `${name}: バンドルサイズ上限が必要です`);
    const catalog = 'catalog' in testCase && testCase.catalog;
    const selectedLayout = 'layout' in testCase ? testCase.layout : undefined;
    const overlaySelection = name === 'Selected wireframe dialog' || name === 'Selected wireframe toast';
    const decorationSelection = name === 'Selected wireframe states' || name === 'Selected robot markers';
    const widgetSelection = name === 'Selected wireframe widgets' || name === 'Selected monitoring widget' || name === 'Selected screen widgets';
    writeFileSync(entry, source);
    const es = await esbuild({absWorkingDir: consumer, entryPoints: [entry], bundle: true, minify: true, keepNames: !!selectedLayout || widgetSelection || decorationSelection || overlaySelection,
      platform: 'browser', format: 'esm', write: false, metafile: true});
    const esOutput = Object.values(es.metafile.outputs)[0];
    assert.ok(esOutput);
    const [viteOutput] = await viteBuild({root: consumer, configFile: false, logLevel: 'silent',
      resolve: {preserveSymlinks: true},
      esbuild: {keepNames: !!selectedLayout || widgetSelection || decorationSelection || overlaySelection},
      build: {write: false, minify: 'esbuild', lib: {entry, formats: ['es']}}});
    const [chunk] = viteOutput.output;
    assert.equal(chunk.type, 'chunk');
    const esModules = Object.entries(esOutput.inputs).filter(([, info]) => info.bytesInOutput > 0).map(([file]) => file);
    const viteModules = Object.entries(chunk.modules).filter(([, info]) => info.renderedLength > 0).map(([file]) => file);
    for (const [bundler, bytes, files, code] of [
      ['esbuild', esOutput.bytes, esModules, es.outputFiles[0]?.text],
      ['Vite', Buffer.byteLength(chunk.code), viteModules, chunk.code],
    ] as const) {
      const label = `${bundler}: ${name}`;
      const has = (filename: string) => files.some(file => ('/' + file.replaceAll('\\', '/')).endsWith('/' + filename));
      assert.ok(has(include), `${label} に ${include} が必要です`);
      if (name === 'Comic + browser measurer') assert.ok(has('web-measure.js'), label);
      if (name === 'Core' || name === 'Box') {
        for (const file of ['emit-spotlight.js', 'slide-budget.js', 'slide-budget-live.js', 'layout-measured.js', 'measure.js', 'dsl/render.js']) {
          assert.ok(!has(file), `${label}: unexpected ${file}`);
        }
        assert.ok(!files.some(file => file.includes('__vite-browser-external')), label);
        assert.doesNotMatch(code ?? '', /(?:from\s*|import\s*\(\s*)['"]node:/, label);
      }
      if (catalog) {
        const entries = specBandEntries.filter(({part}) => has('spec-parts/selective/' + part + '.js'));
        assert.deepEqual(entries.map(({part}) => 'spec-parts/selective/' + part + '.js'), [include], label);
      }
      if (name === 'Connect') {
        assert.ok(has('verify-connect-crossings.js') && has('verify-connection-graph.js'), label);
        assert.ok(code);
        assert.doesNotMatch(code, /bracket\(\): label must not be empty|callout\(\): text is required/, label);
      }
      if (name === 'Node and stat') assert.ok(has('dsl/node.js'), label);
      if (name === 'screens') {
        assert.ok(!has('dsl/state-matrix.js') && !has('state-matrix-rules.js'), label);
        assert.ok(!code?.includes('"layoutStateMatrixWith"'), label);
      }
      if (name === 'Selected screen widgets' || name === 'Selected matrix widgets') {
        assert.equal(code?.includes('"layoutScreenGridWith"'), name === 'Selected screen widgets', label);
        assert.equal(code?.includes('"layoutStateMatrixWith"'), name === 'Selected matrix widgets', label);
        assert.equal(code?.includes('"collectScreenGridTextRequestsWith"'), name === 'Selected screen widgets', label);
        assert.equal(code?.includes('"collectStateMatrixTextRequestsWith"'), name === 'Selected matrix widgets', label);
      }
      if (name === 'State matrix') {
        assert.ok(has('dsl/state-matrix.js'), label);
        assert.ok(code?.includes('"layoutStateMatrixWith"') && !code.includes('"layoutScreenGridWith"'), label);
      }
      if (name === 'Selected table spec') assert.ok(has('table-number-rules.js'), label);
      if (name === 'PPTX flow adapter') {
        assert.ok(code);
        assert.doesNotMatch(code, /\(["'](?:legend|axes|axis)["'],\s*0,\s*["']["']\)/, label);
      }
      if (name === 'Core') assert.ok(!code?.includes('許容するなら diagram'), label);
      if (name === 'Core' || draw) {
        assert.deepEqual(bandModules(files), bands ?? (draw ? [path.basename(include)] : []), `${label} の帯`);
      }
      for (const filename of exclude) assert.ok(!has(filename), `${label} に ${filename} が残っています`);
      if (name === 'Wireframe button builder') {
        assert.ok(code);
        assert.doesNotMatch(code, /['"](?:text|region|fusion|insight)['"]/, label);
      }
      const limit = budget?.[bundler];
      if (limit !== undefined) assert.ok(bytes <= limit, `${label} が ${limit} バイトを超えています (${bytes})`);
      if ('check' in testCase) {
        assert.ok(code);
        const {draw: render} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
        testCase.check(await render(), label);
      }
      if (draw) {
        recordBandModules(bundler, files);
        assert.ok(code);
        if (overlaySelection) {
          assert.equal(code.includes('"drawDialog"'), name === 'Selected wireframe dialog', label);
          assert.equal(code.includes('"drawToast"'), name === 'Selected wireframe toast', label);
        }
        if (decorationSelection) {
          assert.equal(code.includes('"drawStateIcon"'), name === 'Selected wireframe states', label);
          assert.equal(code.includes('"fovSector"'), name === 'Selected robot markers', label);
          assert.ok(!code.includes('"batteryText"'), label);
        }
        if (widgetSelection) {
          assert.ok(code.includes('"textLines"'), label);
          assert.equal(code.includes('"batteryText"'), name === 'Selected monitoring widget', label);
          for (const widget of ['drawMapLegend', 'listRows', 'tableData', 'rng', 'drawThermal', 'insightData', 'compactRobot', 'drawState', 'signalText']) {
            assert.ok(!code.includes(JSON.stringify(widget)), `${label}: ${widget}`);
          }
        }
        if (selectedLayout) {
          // These functions share a source module. Keep their names so the test can detect unused implementations inside it.
          for (const [shape, layout] of [...flowSamples, ...quantitySamples, ...tableSamples]) {
            assert.equal(code.includes(JSON.stringify(layout)), layout === selectedLayout, `${label}: ${layout}`);
            assert.equal(code.includes(JSON.stringify(shape + 'Texts')), layout === selectedLayout, `${label}: ${shape}Texts`);
          }
          if (screenSamples.some(([, layout]) => layout === selectedLayout)) {
            for (const [, layout] of screenSamples) assert.equal(code.includes(JSON.stringify(layout)), layout === selectedLayout, label);
          }
          if (tableSamples.some(([, layout]) => layout === selectedLayout)) {
            assert.equal(code.includes('"renderSequence"'), name === 'sequence', label);
            assert.equal(code.includes('"renderTable"'), name === 'table', label);
          }
        }
        const {draw: render} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
        const result = await render();
        for (const [name, target] of outputAdapters) {
          if (!source.includes(`'svg-diagram${name.slice(1)}'`)) continue;
          // This public entry re-exports the implementation used by the fixture.
          const module = name === './pptx/bands/box' ? 'lib/pptx/box-band.js' : target.default?.replace(/^\.\/dist\//, '');
          assert.ok(module && has(module), `${label}: ${name} のアダプターが出力されていません`);
          testedOutputAdapters[bundler].add(name);
        }

        if (name === 'Selected Edge PPTX deck') {
          assert.deepEqual(result.issues, [], label);
          assert.deepEqual(result.slides.map((slide: {native: number; pictures: number}) => [slide.native, slide.pictures]), [[1, 0], [1, 0]], label);
          assert.equal(result.slides[1].columns.length, 2, label);
          assert.deepEqual([...result.pptx.subarray(0, 4)], [0x50, 0x4b, 3, 4], label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selected Edge PPTX table') {
          assert.deepEqual(result.issues, [], label);
          assert.equal(result.native, 1, label);
          assert.equal(result.pictures, 0, label);
          assert.deepEqual([...result.pptx.subarray(0, 4)], [0x50, 0x4b, 3, 4], label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selective PPTX image') {
          assert.deepEqual(result.fallbacks, [{type: 'image', id: 'picture'}], label);
          assert.equal(result.verdict.ok, true, label);
          const pptx = new TextDecoder().decode(result.pptx);
          assert.match(pptx, /<p:pic>/, label);
          assert.match(pptx, /name="anchor-picture"/, label);
          assert.match(pptx, /data:image\/png;base64,/i, label);
          assert.doesNotMatch(code, /@resvg|HarfBuzz/, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name.startsWith('Selective PPTX')) {
          assert.deepEqual(result.fallbacks, [], label);
          assert.equal(result.verdict.ok, true, label);
          const expected = name === 'Selective PPTX Table' ? /<a:tbl>[\s\S]*>Done<\/a:t>/
            : (name === 'Selective PPTX Caption' || name === 'Selective PPTX Banner') ? /<p:sp>[\s\S]*>Review<\/a:t>/ : /<p:grpSp>[\s\S]*>Review<\/a:t>/;
          const slide = new TextDecoder().decode(result.pptx);
          assert.match(slide, expected, label);
          if (/^Selective PPTX (Cause|States|Tree)$/.test(name)) {
            assert.match(slide, /<p:cxnSp>[\s\S]*?<a:stCxn id="\d+" idx="\d+"\/>[\s\S]*?<a:endCxn id="\d+" idx="\d+"\/>/, label);
          }
          if (name === 'Selective PPTX Swimlane') assert.match(slide, /name="swimlane[^"]*"[\s\S]*name="lanes"/, label);
          if (name === 'Selective PPTX Legend') assert.match(slide, /name="legend-and-arc"/, label);
          if (name === 'Selective PPTX') assert.match(slide, /<p:cxnSp>[\s\S]*?name="row-arrow-0"/, label);
          assert.doesNotMatch(code, /@resvg|HarfBuzz/, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selective HTML image') {
          assert.deepEqual(result.fallbacks, [{type: 'image', id: 'picture'}], label);
          assert.equal(result.verdict.ok, true, label);
          assert.match(result.html, /<svg[\s\S]*<image\b[^>]*href="data:image\/gif;base64,/i, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (['Selective HTML', 'Selective HTML grid', 'Selective HTML row', 'Selective HTML group'].includes(name)) {
          assert.match(result.html, /class="sd-b"[\s\S]*>Review<\/div>/, label);
          assert.doesNotMatch(result.html, /<svg|<table/, label);
          assert.doesNotMatch(code, /<table style=/, label);
          assert.deepEqual(result.fallbacks, [], label);
          assert.equal(result.verdict.ok, true, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selective HTML caption') {
          assert.match(result.html, /class="sd-t"[^>]*>Review<\/div>/, label);
          assert.doesNotMatch(result.html, /class="sd-b"|<svg\b/, label);
          assert.deepEqual(result.fallbacks, [], label);
          assert.equal(result.verdict.ok, true, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selective HTML banner') {
          assert.match(result.html, /class="sd-t"[^>]*>Review<\/div>/, label);
          assert.match(result.html, /class="sd-b"/, label);
          assert.doesNotMatch(result.html, /<svg\b/, label);
          assert.deepEqual(result.fallbacks, [], label);
          assert.equal(result.verdict.ok, true, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selective HTML table') {
          assert.match(result.html, /<table style=[\s\S]*<th scope="col"[\s\S]*>Review<\/div>/, label);
          assert.doesNotMatch(result.html, /<svg/, label);
          assert.deepEqual(result.fallbacks, [], label);
          assert.equal(result.verdict.ok, true, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selective HTML overlay') {
          assert.match(result.html, /class="sd-t[^"]*"[^>]*>Review<\/div>/, label);
          assert.doesNotMatch(result.html, /<text\b/, label);
          assert.deepEqual(result.fallbacks, [{type: 'curve'}], label);
          assert.equal(result.verdict.ok, true, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selected table spec on Edge') {
          assert.equal(result.ok, true, label);
          assert.doesNotMatch(result.svg, /<text\b/, label);
          assert.match(result.svg, /aria-label="Review"/, label);
          assert.match(result.svg, /<use href="#sd-glyph-/, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (catalog) {
          if (name === 'Spec catalog: table') assert.ok(result.verdict.warnings.some((warning: string) =>
            warning.startsWith('[rowheader-tone-collides]') && warning.includes('check --explain rowheader-tone-collides')), label);
          assert.match(result.svg, /<svg\b/, label);
          assert.match(result.svg, /<text\b/, label);
          assert.deepEqual(result.xml, [], label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Spacer') {
          assert.match(result.svg, /viewBox="0 0 940 48"/, label);
          assert.doesNotMatch(result.svg, /<text\b/, label);
          assert.deepEqual(result.xml, [], label);
          assert.equal(result.verdict.ok, true, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        assert.match(result.svg, name === 'Sankey' ? /<text[^>]*>Review 5<\/text>/ : name === 'funnel' ? /<text[^>]*>Review +1<\/text>/ : name === 'Composer Arrow diagram' ? /<text[^>]*>Review 3<\/text>/ : /<text[^>]*>Review<\/text>/, label);
        if (name === 'Comic' || name === 'Comic + browser measurer') assert.match(result.svg, /data-comic="1x2"/, label);
        if (name === 'Image') {
          assert.match(result.svg, /<image [^>]*href="data:image\/gif;base64,/);
          assert.doesNotMatch(code, /\bBuffer\b/, label);
        }
        if (name === 'Selected wireframe states') assert.match(result.svg, /古い情報/, label);
        if (name === 'Selected robot markers') assert.match(result.svg, /ロボット A/, label);
        if (name === 'RACI table') assert.ok(!/fmea\(\)|qfd\(\)|whyWhyTree\(/.test(code), label);
        if (name === 'Selected fault tree spec with legend') assert.match(result.svg, /OR gate/, label);
        if (name === 'Basic wireframe') assert.ok(result.verdict.warnings.some((warning: string) => warning.includes('check --explain wf-callout-no-note')), label);
        if (name === 'bracket') assert.match(result.svg, />範囲<\/text>/, label);
        if (name === 'callout') assert.match(result.svg, />注意<\/text>/, label);
        if (name === 'branch') assert.match(result.svg, />次へ<\/text>/, label);
        if (name === 'Connect') assert.deepEqual(result.verdict.findings.filter((finding: {rule: string}) => finding.rule.startsWith('graph-')).map((finding: {rule: string}) => finding.rule), ['graph-orphan-node', 'graph-disconnected'], label);
        if (name === 'Cause') assert.equal(result.verdict.findings.filter((finding: {rule: string}) => finding.rule === 'toc-legend-suggested').length, 1, label);
        if (name === 'Caption and spacer') assert.match(result.svg, /<title id="svg-title">Review<\/title>/, label);
        if (name === 'Document findings') {
          assert.ok(result.verdict.warnings.some((warning: string) => warning.includes('check --explain doc-width')), label);
          assert.ok(result.verdict.warnings.some((warning: string) => warning.includes('check --explain glyph-missing')), label);
        }
        if (name === 'Gantt') {
          assert.match(result.svg, />第一段階<\/text>/, label);
          assert.match(result.svg, />基準日<\/text>/, label);
          assert.match(result.svg, />公開<\/text>/, label);
          assert.match(result.svg, /<path d="M[\d,]+ L[\d,]+ L[\d,]+ L[\d,]+ z"[^>]*stroke-width="2"/, label);
          assert.match(result.svg, /<path d="M[\d,]+ L[\d,]+ L[\d,]+ L[\d,]+"[^>]*stroke-width="1.5"/, label);
        }
        if (name === 'Box') assert.ok(result.verdict.findings.some((finding: {rule: string}) => finding.rule === 'box-size-ignored'), label);
        if (name === 'Spotlight') assert.deepEqual(result.laidOut.laidOut.map((band: {dim?: boolean}) => band.dim), [false, true], label);
        if (name === 'Slide fill') {
          assert.equal(result.width, 640, label);
          assert.ok(result.fontScale > 1 && result.height <= 200, label);
        }
        if (name === 'Node and stat') assert.match(result.svg, /出典: Report/, label);
        if (name === 'Composer Canvas') assert.ok(result.verdict.findings.some((finding: {rule: string}) => finding.rule === 'canvas-region-empty'), label);
        if (name === 'funnel') assert.ok(result.verdict.findings.some((finding: {rule: string}) => finding.rule === 'funnel-values-rise'), label);
        if (name === 'Row loop-back' || name === 'Selected steps spec') assert.match(result.svg, /Retry/, label);
        if (name === 'Selected table spec') assert.match(result.svg, /<desc id="svg-desc">表: 列 Review<\/desc>/, label);
        if (name === 'Prepared table spec with description') assert.match(result.svg, /<desc id="svg-desc">表: 列 Review<\/desc>/, label);
        else assert.deepEqual(result.xml, [], label);
        assert.equal(result.verdict.ok, true, label);
      }
      console.log(`${label}: ${bytes} bytes`);
    }
  }
  async function buildNode(source: string, external: string[] = [], keepNames = false) {
    writeFileSync(entry, source);
    const es = await esbuild({absWorkingDir: consumer, entryPoints: [entry], bundle: true, minify: true,
      platform: 'node', format: 'esm', keepNames, write: false, metafile: true, external});
    const ssr = await viteBuild({root: consumer, configFile: false, logLevel: 'silent',
      esbuild: {keepNames}, resolve: {preserveSymlinks: true}, ssr: {noExternal: ['svg-diagram'], external},
      build: {ssr: entry, target: 'node22', write: false, minify: 'esbuild'}});
    const [nodeBundle] = es.outputFiles;
    const [esOutput] = Object.values(es.metafile.outputs);
    const [ssrChunk] = ssr.output;
    assert.ok(nodeBundle && esOutput);
    assert.equal(ssrChunk.type, 'chunk');
    const esChunks: [JsChunk] = [{fileName: 'entry.mjs', code: nodeBundle.text}];
    const ssrChunks: [JsChunk, ...JsChunk[]] = [ssrChunk, ...ssr.output.slice(1).filter((output: {type: string}) => output.type === 'chunk')];
    return [
      ['esbuild', Object.entries(esOutput.inputs).filter(([, info]) => info.bytesInOutput > 0).map(([file]) => file), esChunks],
      ['Vite', Object.entries(ssrChunk.modules).filter(([, info]) => info.renderedLength > 0).map(([file]) => file), ssrChunks],
    ] as const;
  }

  // The bundled source loader has moved away from its sibling modules. Resolve the
  // published DSL here so the on-disk diagram can also be loaded by that bundle.
  writeFileSync(diagramFile, `
    import {diagram, box} from ${JSON.stringify(pathToFileURL(require.resolve('svg-diagram')).href)};
    export default () => diagram({theme: 'blue'}).add(box({title: 'Review'}));
  `);
  writeFileSync(path.join(consumer, '.svg-diagram.json'), '{"measure":"font"}');
  const backends = ['harfbuzzjs', 'playwright', 'playwright-chromium', '@resvg/resvg-js'];
  const markdownDeps = ['markdown-it', 'unified', 'remark-parse', 'remark-rehype', 'rehype-stringify'];
  for (const dependency of ['harfbuzzjs', '@resvg/resvg-js', ...markdownDeps]) {
    const link = path.join(consumer, 'node_modules', dependency);
    mkdirSync(path.dirname(link), {recursive: true});
    symlinkSync(path.join(root, 'node_modules', dependency), link, 'junction');
  }
  for (const {name, source, budget, check} of nodeDrawCases) {
    for (const [bundler, files, chunks] of await buildNode(source, [...backends, ...markdownDeps])) {
      const label = `${bundler} (Node): ${name}`;
      const bytes = chunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0);
      assert.ok(bytes <= budget[bundler], `${label} が ${budget[bundler]} バイトを超えています (${bytes})`);
      if (name === './markdown') checkMarkdownBundle(bundler, files, label);
      const output = mkdtempSync(path.join(consumer, 'node-bundle-'));
      // Markdown-it and VitePress start the published worker as a separate Node process.
      symlinkSync(path.join(root, 'dist/lib/render-sync-worker.js'), path.join(output, 'render-sync-worker.js'), 'file');
      for (const chunk of chunks) {
        const file = path.join(output, chunk.fileName);
        mkdirSync(path.dirname(file), {recursive: true});
        writeFileSync(file, chunk.code);
      }
      const [main] = chunks;
      const {draw} = await import(pathToFileURL(path.join(output, main.fileName)).href);
      check(await draw(), label);
      console.log(`${label}: ${bytes} bytes`);
    }
  }

  function checkMarkdownBundle(bundler: string, files: string[], label: string): void {
    assert.ok(files.some(file => file.replaceAll('\\', '/').endsWith('/render-source-file.js')), label);
    assert.ok(!files.some(file => /\/lib\/(?:(?:spec(?:-render)?|raster)\.js$|spec-parts\/)/.test(file.replaceAll('\\', '/'))), label);
    if (bundler === 'Vite') {
      assert.ok(!files.some(file => /[/\\](?:(?:cdp-)?browser|slide-budget(?:-live)?)\.js$/.test(file)), `${label}: optional browser or Slidev code is in the initial chunk`);
    }
  }

  const nodeSpecCases = await buildNode(nodeSpecSource, ['harfbuzzjs']);
  for (const [bundler, files, [{code}]] of nodeSpecCases) {
    const label = `${bundler} (Node): Selected table spec`;
    assert.deepEqual(bandModules(files), ['table.js'], label);
    const has = (name: string) => files.some(file => file.replaceAll('\\', '/').endsWith('/' + name));
    for (const file of ['spec-selective-node.js', 'node-measure.js', 'font-metrics.js', 'bands/table.js']) assert.ok(has(file), `${label}: missing ${file}`);
    for (const file of [...legacy, 'lib/spec.js', 'spec-render.js', 'measure.js', 'png.js', 'raster.js', 'bands/gantt.js', 'bands/box.js']) {
      assert.ok(!has(file), `${label}: unexpected ${file}`);
    }
    assert.ok(!files.some(file => /[/\\](?:playwright[^/\\]*|@resvg)[/\\]/.test(file)), label);
    assert.ok(!/(?:from\s*|import\(\s*)["'](?:playwright|@resvg\/)/.test(code), label);
    const output = path.join(consumer, `table-${bundler}.mjs`);
    writeFileSync(output, code);
    const {draw} = await import(pathToFileURL(output).href);
    const result = await draw();
    assert.equal(result.ok, true, label);
    assert.match(result.svg, /<text[^>]*>Review<\/text>/, label);
    const bytes = Buffer.byteLength(code);
    assert.ok(bytes <= 119500, `${label}: ${bytes} bytes exceeds 119500`);
    console.log(`${label}: ${bytes} bytes`);
  }

  writeFileSync(pictureFile, Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  const imageCases = await buildNode(imageSource, [], true);
  for (const [bundler, files, [{code}]] of imageCases) {
    const label = `${bundler} (Node): Image`;
    assert.deepEqual(bandModules(files), ['image-node.js', 'image.js'], label);
    const has = (name: string) => files.some(file => file.replaceAll('\\', '/').endsWith('/' + name));
    for (const file of ['bands/image-node.js', 'image-file.js', 'emit-image.js']) assert.ok(has(file), `${label}: missing ${file}`);
    for (const file of [...legacy, 'dsl/io.js', 'layout-connect.js', 'bands/box.js']) assert.ok(!has(file), `${label}: unexpected ${file}`);
    assert.ok(code.includes('"resolveImageBand"'), label);
    assert.ok(!code.includes('"resolveImages"'), label);
    const {draw} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    const result = await draw();
    assert.match(result.svg, /<image [^>]*href="data:image\/gif;base64,/);
    assert.deepEqual(result.xml, []);
    assert.equal(result.verdict.ok, true);
    recordBandModules(bundler, files);
    const bytes = Buffer.byteLength(code);
    assert.ok(bytes <= 70000, `${label}: ${bytes} bytes exceeds 70000`);
    console.log(`${label}: ${bytes} bytes`);
  }

  const mathCases = await buildNode(mathSource);
  for (const [bundler, inputs, [{code}]] of mathCases) {
    const label = `${bundler} (Node): Math`;
    assert.deepEqual(bandModules(inputs), ['math.js'], label);
    const files = inputs.map(file => file.replaceAll('\\', '/'));
    assert.ok(files.some(file => file.endsWith('/bands/math.js')), `${label}: missing selective math entry`);
    assert.ok(files.some(file => file.endsWith('/math-tex.js')), `${label}: missing TeX conversion`);
    for (const file of ['dsl/io.js', 'layout-handlers.js', 'verify-handlers.js', 'emit-handlers.js', 'emit-figures.js', 'image-file.js', 'bands/image-node.js', 'layout-connect.js', 'gantt.js']) {
      assert.ok(!files.some(input => input.endsWith('/' + file)), `${label}: unexpected ${file}`);
    }
    assert.ok(!files.some(file => file.includes('/mathjax-full/')), `${label}: MathJax must be loaded at runtime`);
    const bytes = Buffer.byteLength(code);
    const budget = bundler === 'esbuild' ? 62000 : 85000;
    assert.ok(bytes <= budget, `${label}: ${bytes} bytes exceeds ${budget}`);
    const output = path.join(consumer, `formula-${bundler}.mjs`);
    writeFileSync(output, code);
    const {draw} = await import(pathToFileURL(output).href);
    // Even the first bundle can be imported before MathJax is installed in the consumer.
    const mathjaxPath = path.join(consumer, 'node_modules/mathjax-full');
    if (bundler === 'esbuild') symlinkSync(path.dirname(require.resolve('mathjax-full/package.json')), mathjaxPath, 'junction');
    const drawn = await draw();
    assert.match(drawn.svg, /<g data-math=""[^>]*aria-label="Square"[^>]*>[\s\S]*?<path /);
    assert.deepEqual(drawn.xml, []);
    assert.equal(drawn.verdict.ok, true);
    recordBandModules(bundler, files);
    console.log(`${label}: ${bytes} bytes`);
  }

  const bandEntries = publicEntries
    .filter(([name]) => name.startsWith('./bands/'));
  for (const [bundler, seen] of Object.entries(testedBandModules)) {
    const missing = bandEntries.filter(([, conditions]) =>
      !seen.has(path.basename(conditions.default ?? conditions.node ?? ''))).map(([name]) => name);
    assert.deepEqual(missing, [], `${bundler}: 未描画の帯の公開入口`);
  }

  for (const [bundler, seen] of Object.entries(testedOutputAdapters)) {
    const missing = outputAdapters.map(([name]) => name).filter(name => !seen.has(name));
    assert.deepEqual(missing, [], `${bundler}: 未描画の HTML・PPTX アダプターの公開入口`);
  }

  const deck = await esbuild({absWorkingDir: root, entryPoints: ['dist/lib/deck-load.js'], bundle: true,
    packages: 'external', platform: 'node', format: 'esm', write: false, metafile: true});
  assert.ok(Object.keys(deck.metafile.inputs).every(file => !file.replaceAll('\\', '/').includes('/pptx/')),
    'デッキの読み込みに PPTX のコードが含まれています');
} catch (error) {
  if (!(error instanceof ExportClassificationError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(consumer, {recursive: true, force: true});
}
