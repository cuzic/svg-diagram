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
  const composedSource = (components: string[], bands: string, extraImports = '') => `
    import {renderBands} from 'svg-diagram/core';
    ${components.map(name => `import {${name}} from 'svg-diagram/bands/${name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}';`).join('\n')}
    ${extraImports}
    export const draw = () => renderBands([${bands}], {
      measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
    });
  `;
  const legacy = ['web.js', 'layout-handlers.js', 'verify-handlers.js', 'emit-handlers.js', 'rules.js', 'math-tex.js'];
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
  const tableSamples = [
    ['sequence', 'layoutSequence', "sequence([{id: 'a', label: 'Review'}, {id: 'b', label: 'API'}], [{from: 'a', to: 'b', label: 'Send'}])"],
    ['table', 'layoutTable', "table([{label: 'Review'}, {label: 'Value', mono: true}], [['Name', 'ABC']])"],
  ] as const;
  const screenSamples = [
    ['wireframe', 'layoutWireframe', "wireframe(wf.col([wf.region('Review')]))"],
    ['screens', 'layoutScreens', "screens([{id: 'review', title: 'Review', root: wf.col([wf.region('Details')])}], {cols: 1})"],
  ] as const;
  const cases = [
    {name: 'SVG', source: "export {renderInBrowser} from 'svg-diagram/browser';", include: 'web.js', exclude: ['emit-html.js', 'math-tex.js']},
    {name: 'HTML', source: "export {emitHtml} from 'svg-diagram/html';", include: 'emit-html.js', exclude: ['web.js', 'web-measure.js']},
    {name: '文字測定', source: "export {canvasMeasurer} from 'svg-diagram/measure/browser';", include: 'web-measure.js', exclude: ['web.js', 'emit-html.js', 'pipeline.js', 'layout-handlers.js']},
    {name: 'Core', source: "export {renderBands} from 'svg-diagram/core';", include: 'core.js',
      exclude: [...legacy, 'box.js', 'gantt.js', 'emit-boxes.js', 'emit-gantt.js'], budget: {esbuild: 52000, Vite: 65000}},
    {name: 'Box', source: bandSource('box'), include: 'bands/box.js',
      exclude: [...legacy, 'gantt.js', 'emit-gantt.js', 'timeline.js', 'people.js', 'emit-fta.js'], budget: {esbuild: 75500, Vite: 95000}, draw: true},
    {name: 'Gantt', source: bandSource('gantt'), include: 'bands/gantt.js',
      exclude: [...legacy, 'box.js', 'emit-boxes.js', 'layout-connect.js', 'timeline.js'], budget: {esbuild: 68000, Vite: 83000}, draw: true},
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
    {name: 'Status', source: composedSource(['status'], "status('draft', 'Review')"),
      include: 'bands/status.js', budget: {esbuild: 55000, Vite: 73000}, exclude: [...legacy, 'wordart.js', 'flow-shapes.js', 'gantt.js', 'layout-connect.js'], draw: true},
    {name: 'Wordart', source: composedSource(['wordart'], "wordart('Review', {style: 'outline', size: 40})"),
      include: 'bands/wordart.js', budget: {esbuild: 75000, Vite: 100000}, exclude: [...legacy, 'flow-shapes.js', 'gantt.js', 'layout-connect.js'], draw: true},
    {name: 'Legend', source: composedSource(['legend'], "legend([{label: 'Review', role: 'root'}, {label: 'Gate', ftaGate: 'and'}, {label: 'Link', weight: 'strong'}])"),
      include: 'bands/legend.js', budget: {esbuild: 62000, Vite: 83000}, exclude: [...legacy, 'toc.js', 'fta.js', 'emit-fta.js', 'gantt.js', 'layout-connect.js'], draw: true},
    {name: 'Quadrant', source: composedSource(['quadrant'], "quadrant.preset('bcg', {items: [{label: 'Review', cell: [0, 0]}]})"),
      include: 'bands/quadrant.js', budget: {esbuild: 94000, Vite: 123000}, exclude: [...legacy, 'flow-shapes.js', 'plane.js', 'gantt.js', 'layout-connect.js', 'dsl/figures.js'], draw: true},
    {name: 'Plane', source: composedSource(['plane'], "plane({x: {max: 20, step: 10}, y: {max: 10, step: 5}, points: [{at: [10, 5], label: 'Review', reveal: 2}]})"),
      include: 'bands/plane.js', budget: {esbuild: 78000, Vite: 104000}, exclude: [...legacy, 'quadrant.js', 'flow-shapes.js', 'gantt.js', 'reveal-handlers.js', 'layout-connect.js'], draw: true},
    {name: 'Bars', source: composedSource(['bars'], "bars([{id: 'old', label: 'Draft', value: 4}, {label: 'Review', value: 6, reveal: 2, replaces: 'old'}])"),
      include: 'bands/bars.js', budget: {esbuild: 83000, Vite: 111000}, exclude: [...legacy, 'plane.js', 'qc-plane.js', 'qc.js', 'gantt.js', 'reveal-handlers.js'], draw: true},
    ...tableSamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample), include: `bands/${name}.js`,
      budget: {esbuild: 77000, Vite: 102000},
      exclude: [...legacy, 'layout-connect.js', 'gantt.js', 'wireframe.js', 'lane-order.js'], draw: true,
    })),
    ...screenSamples.map(([name, layout, sample]) => ({
      name, layout, source: composedSource([name], sample, `import {wf} from 'svg-diagram/bands/${name}';`), include: `bands/${name}.js`,
      budget: {esbuild: 110000, Vite: 151000},
      exclude: [...legacy, 'layout-connect.js', 'gantt.js', 'seq-table.js', 'flow-shapes.js'], draw: true,
    })),
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
        assert.match(result.svg, /<text[^>]*>Review<\/text>/, label);
        if (name === 'Row loop-back') assert.match(result.svg, /Retry/, label);
        assert.deepEqual(result.xml, [], label);
        assert.equal(result.verdict.ok, true, label);
      }
      console.log(`${label}: ${bytes} bytes`);
    }
  }
  writeFileSync(entry, composedSource(['math'], "math('x^2', {alt: 'Square'})"));
  const formula = await esbuild({absWorkingDir: consumer, entryPoints: [entry], bundle: true, minify: true,
    platform: 'node', format: 'esm', write: false, metafile: true});
  const ssrOutput = await viteBuild({root: consumer, configFile: false, logLevel: 'silent',
    resolve: {preserveSymlinks: true}, ssr: {noExternal: ['svg-diagram']},
    build: {ssr: entry, write: false, minify: 'esbuild'}});
  const [nodeBundle] = formula.outputFiles;
  const [ssrChunk] = ssrOutput.output;
  assert.ok(nodeBundle);
  assert.equal(ssrChunk.type, 'chunk');
  const mathCases = [
    ['esbuild', Object.keys(formula.metafile.inputs), nodeBundle.text, 60000],
    ['Vite', Object.keys(ssrChunk.modules), ssrChunk.code, 85000],
  ] as const;
  for (const [bundler, inputs, code, budget] of mathCases) {
    const label = `${bundler} (Node): Math`;
    const files = inputs.map(file => file.replaceAll('\\', '/'));
    assert.ok(files.some(file => file.endsWith('/bands/math.js')), `${label}: missing selective math entry`);
    assert.ok(files.some(file => file.endsWith('/math-tex.js')), `${label}: missing TeX conversion`);
    for (const file of ['dsl/io.js', 'layout-handlers.js', 'verify-handlers.js', 'emit-handlers.js', 'layout-connect.js', 'gantt.js']) {
      assert.ok(!files.some(input => input.endsWith('/' + file)), `${label}: unexpected ${file}`);
    }
    assert.ok(!files.some(file => file.includes('/mathjax-full/')), `${label}: MathJax must be loaded at runtime`);
    const bytes = Buffer.byteLength(code);
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
    console.log(`${label}: ${bytes} bytes`);
  }

  const deck = await esbuild({absWorkingDir: root, entryPoints: ['dist/lib/deck-load.js'], bundle: true,
    packages: 'external', platform: 'node', format: 'esm', write: false, metafile: true});
  assert.ok(Object.keys(deck.metafile.inputs).every(file => !file.replaceAll('\\', '/').includes('/pptx/')),
    'デッキの読み込みに PPTX のコードが含まれています');
} finally {
  rmSync(consumer, {recursive: true, force: true});
}
