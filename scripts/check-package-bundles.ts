import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build as esbuild} from 'esbuild';

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
      ? "box({title: 'Review'})"
      : "gantt([{label: 'Review', start: '2026-11-23', days: 3}])"}], {
      measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
    });
  `;
  const composedSource = (components: string[], bands: string) => `
    import {renderBands} from 'svg-diagram/core';
    ${components.map(name => `import {${name}} from 'svg-diagram/bands/${name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}';`).join('\n')}
    export const draw = () => renderBands([${bands}], {
      measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
    });
  `;
  const legacy = ['web.js', 'layout-handlers.js', 'verify-handlers.js', 'emit-handlers.js', 'rules.js'];
  const flowSamples = [
    ['chevron', 'layoutChevron', "chevron([{label: 'Review'}, {label: 'Release'}])"],
    ['funnel', 'layoutFunnel', "funnel([{label: 'Review'}, {label: 'Release'}])"],
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
  const cases = [
    {name: 'SVG', source: "export {renderInBrowser} from 'svg-diagram/browser';", include: 'web.js', exclude: ['emit-html.js']},
    {name: 'HTML', source: "export {emitHtml} from 'svg-diagram/html';", include: 'emit-html.js', exclude: ['web.js', 'web-measure.js']},
    {name: '文字測定', source: "export {canvasMeasurer} from 'svg-diagram/measure/browser';", include: 'web-measure.js', exclude: ['web.js', 'emit-html.js', 'pipeline.js', 'layout-handlers.js']},
    {name: 'Core', source: "export {renderBands} from 'svg-diagram/core';", include: 'core.js',
      exclude: [...legacy, 'box.js', 'gantt.js', 'emit-boxes.js', 'emit-gantt.js'], budget: {esbuild: 52000, Vite: 65000}},
    {name: 'Box', source: bandSource('box'), include: 'bands/box.js',
      exclude: [...legacy, 'gantt.js', 'emit-gantt.js', 'timeline.js', 'people.js', 'emit-fta.js'], budget: {esbuild: 75500, Vite: 95000}, draw: true},
    {name: 'Gantt', source: bandSource('gantt'), include: 'bands/gantt.js',
      exclude: [...legacy, 'box.js', 'emit-boxes.js', 'layout-connect.js', 'timeline.js'], budget: {esbuild: 68000, Vite: 82000}, draw: true},
    {name: 'Row', source: composedSource(['box', 'row'], "row([box({title: 'Review'}), box({title: 'Next'})], {arrows: 'between'})"),
      include: 'bands/row.js', budget: {esbuild: 84000, Vite: 108000}, bands: ['box.js', 'row.js'], exclude: [...legacy, 'layout-grid.js', 'layout-connect.js', 'layout-group.js', 'layout-group-row.js', 'layout-areas.js', 'gantt.js'], draw: true},
    {name: 'Grid', source: composedSource(['box', 'grid'], "grid([box({title: 'Review'}), box({title: 'Next'})], {cols: 2})"),
      include: 'bands/grid.js', budget: {esbuild: 79000, Vite: 102000}, bands: ['box.js', 'grid.js'], exclude: [...legacy, 'layout-row.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Connect', source: composedSource(['box', 'connect'], "connect('a:bottom', 'b:top'), box({id: 'a', title: 'Review'}), box({id: 'b', title: 'Next'})"),
      include: 'bands/connect.js', budget: {esbuild: 89000, Vite: 115000}, bands: ['box.js', 'connect.js'], exclude: [...legacy, 'layout-row.js', 'layout-grid.js', 'gantt.js'], draw: true},
    {name: 'Row loop-back', source: `
      import {renderBands} from 'svg-diagram/core';
      import {box} from 'svg-diagram/bands/box';
      import {row} from 'svg-diagram/bands/row';
      import {connectDefinition} from 'svg-diagram/bands/connect';
      export const draw = () => renderBands([
        row([box({title: 'Review'}), box({title: 'Next'})], {loopBack: {from: 2, to: 1, label: 'Retry'}})
      ], {connectors: connectDefinition, measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size})});
    `, include: 'bands/row.js', budget: {esbuild: 100000, Vite: 129000}, bands: ['box.js', 'connect.js', 'row.js'], exclude: [...legacy, 'layout-grid.js', 'gantt.js'], draw: true},
    {name: 'Caption and spacer', source: composedSource(['caption', 'spacer'], "caption('Review', {mono: true}), spacer(24), caption('Next')"),
      include: 'bands/caption.js', budget: {esbuild: 58000, Vite: 77000}, bands: ['caption.js', 'spacer.js'], exclude: [...legacy, 'layout-row.js', 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Group', source: composedSource(['box', 'group'], "group(box({title: 'Review'}), {title: 'Plan'})"),
      include: 'bands/group.js', budget: {esbuild: 80000, Vite: 104000}, bands: ['box.js', 'caption.js', 'group.js'], exclude: [...legacy, 'layout-row.js', 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Group row', source: composedSource(['box', 'group', 'groupRow'], "groupRow([group(box({title: 'Review'})), box({title: 'Next'})])"),
      include: 'bands/group-row.js', budget: {esbuild: 90000, Vite: 116000}, bands: ['box.js', 'caption.js', 'group-row.js', 'group.js'], exclude: [...legacy, 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Areas', source: composedSource(['areas', 'box'], "areas(['wide wide', 'left right'], {wide: box({title: 'Review'}), left: box({title: 'Left'}), right: box({title: 'Right'})})"),
      include: 'bands/areas.js', budget: {esbuild: 90000, Vite: 116000}, bands: ['areas.js', 'box.js', 'caption.js', 'group.js'], exclude: [...legacy, 'layout-group-row.js', 'layout-grid.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Banner and raw', source: composedSource(['banner', 'raw'], `banner({headline: 'Review'}), raw({h: 32, draw: ({x, y}) => '<rect x="' + x + '" y="' + y + '" width="24" height="24"/>'})`),
      include: 'bands/banner.js', budget: {esbuild: 61000, Vite: 82000}, bands: ['banner.js', 'raw.js'], exclude: [...legacy, 'layout-areas.js', 'layout-group.js', 'layout-connect.js', 'gantt.js'], draw: true},
    {name: 'Curve', source: composedSource(['curve'], "curve([{y: 0.3, dropLine: true}, {y: 0.8}], {xLabel: 'Review'})"),
      include: 'bands/curve.js', budget: {esbuild: 55000, Vite: 74000}, exclude: [...legacy, 'layout-pyramid.js', 'layout-connect.js', 'flow-shapes.js', 'gantt.js'], draw: true},
    {name: 'Pyramid', source: composedSource(['pyramid'], "pyramid(['Review', 'Plan'])"),
      include: 'bands/pyramid.js', budget: {esbuild: 55000, Vite: 74000}, exclude: [...legacy, 'layout-curve.js', 'layout-connect.js', 'flow-shapes.js', 'gantt.js'], draw: true},
    ...flowSamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample),
      budget: {esbuild: 83000, Vite: 114000},
      include: `bands/${name === 'valueChain' ? 'value-chain' : name}.js`,
      exclude: [...legacy, 'layout-connect.js', 'layout-pyramid.js', 'gantt.js', 'quadrant.js', 'wordart.js'], draw: true,
    })),
    ...quantitySamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample),
      budget: {esbuild: 62000, Vite: 85000},
      include: `bands/${name}.js`, exclude: [...legacy, 'timeline.js', 'layout-connect.js', 'gantt.js'], draw: true,
    })),
    {name: 'Timeline', source: composedSource(['timeline'], "timeline({unit: 'ms', from: 0, to: 100, events: [{at: 25, label: 'Review'}]})"),
      include: 'bands/timeline.js', budget: {esbuild: 72000, Vite: 96000}, exclude: [...legacy, 'people.js', 'gantt.js', 'layout-connect.js'], draw: true},
  ];
  for (const testCase of cases) {
    const {name, source, include, exclude, budget, draw, bands} = testCase;
    const selectedLayout = 'layout' in testCase ? testCase.layout : undefined;
    writeFileSync(entry, source);
    const es = await esbuild({absWorkingDir: consumer, entryPoints: [entry], bundle: true, minify: true, keepNames: !!selectedLayout,
      platform: 'browser', format: 'esm', write: false, metafile: true});
    const esOutput = Object.values(es.metafile.outputs)[0];
    assert.ok(esOutput);
    const [viteOutput] = await viteBuild({root: consumer, configFile: false, logLevel: 'silent',
      resolve: {preserveSymlinks: true},
      esbuild: {keepNames: !!selectedLayout},
      build: {write: false, minify: 'esbuild', lib: {entry, formats: ['es']}}});
    const [chunk] = viteOutput.output;
    assert.equal(chunk.type, 'chunk');
    for (const [bundler, bytes, files, code] of [
      ['esbuild', esOutput.bytes, Object.keys(esOutput.inputs), es.outputFiles[0]?.text],
      ['Vite', Buffer.byteLength(chunk.code), Object.keys(chunk.modules), chunk.code],
    ] as const) {
      const label = `${bundler}: ${name}`;
      const has = (filename: string) => files.some(file => ('/' + file.replaceAll('\\', '/')).endsWith('/' + filename));
      assert.ok(has(include), `${label} に ${include} が必要です`);
      if (name === 'Core' || draw) {
        const usedBands = files.flatMap(file => /(?:^|\/)bands\/([^/]+\.js)$/.exec(file.replaceAll('\\', '/'))?.[1] ?? []);
        assert.deepEqual(usedBands.sort(), bands ?? (draw ? [path.basename(include)] : []), `${label} の帯`);
      }
      for (const filename of exclude) assert.ok(!has(filename), `${label} に ${filename} が残っています`);
      if (name === '文字測定') assert.ok(bytes <= 4000, `${label} が 4000 バイトを超えています`);
      const limit = budget?.[bundler];
      if (limit !== undefined) assert.ok(bytes <= limit, `${label} が ${limit} バイトを超えています (${bytes})`);
      if (draw) {
        assert.ok(code);
        if (selectedLayout) {
          // These functions share a source module. Keep their names so the test can detect unused implementations inside it.
          for (const [shape, layout] of [...flowSamples, ...quantitySamples]) {
            assert.equal(code.includes(JSON.stringify(layout)), layout === selectedLayout, `${label}: ${layout}`);
            assert.equal(code.includes(JSON.stringify(shape + 'Texts')), layout === selectedLayout, `${label}: ${shape}Texts`);
          }
        }
        const {draw: render} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
        const result = await render();
        assert.match(result.svg, /<text[^>]*>Review<\/text>/, label);
        if (name === 'Row loop-back') assert.match(result.svg, /Retry/, label);
        assert.deepEqual(result.xml, [], label);
        assert.equal(result.verdict.ok, true, label);
      }
      console.log(`${label}: ${bytes} bytes`);
    }
  }
  const deck = await esbuild({absWorkingDir: root, entryPoints: ['dist/lib/deck-load.js'], bundle: true,
    packages: 'external', platform: 'node', format: 'esm', write: false, metafile: true});
  assert.ok(Object.keys(deck.metafile.inputs).every(file => !file.replaceAll('\\', '/').includes('/pptx/')),
    'デッキの読み込みに PPTX のコードが含まれています');
} finally {
  rmSync(consumer, {recursive: true, force: true});
}
