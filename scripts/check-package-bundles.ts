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
    {name: 'Selective HTML', source: `
      import {renderBandsHtml} from 'svg-diagram/html/selective';
      import {boxHtml} from 'svg-diagram/html/bands';
      import {box} from 'svg-diagram/bands/box';
      export const draw = () => renderBandsHtml([box({title: 'Review'})], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        fontBox: size => ({ascent: size, descent: 0}),
        adapters: {box: boxHtml}, strict: true,
      });
    `, include: 'html-selective.js', budget: {esbuild: 80000, Vite: 103000}, bands: ['box.js'], exclude: [...legacy, 'emit-html.js', 'lib/emit.js', 'svg-to-css.js', 'emit-tables.js', 'image-file.js'], draw: true},
    {name: 'Selective PPTX', source: `
      import {renderBandsPptx} from 'svg-diagram/pptx';
      import {rowPptx} from 'svg-diagram/pptx/bands/box';
      import {row} from 'svg-diagram/bands/row';
      import {box} from 'svg-diagram/bands/box';
      export const draw = () => renderBandsPptx([row([box({title: 'Review'}), box({title: 'Done'})])], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {row: rowPptx}, strict: true,
      });
    `, include: 'pptx/selective.js', budget: {esbuild: 155000, Vite: 182000}, bands: ['box.js', 'row.js'],
      exclude: [...legacy, 'pptx/bands.js', 'pptx/slide.js', 'pptx/image-band.js', 'pptx/table.js', 'pptx/group-span.js', 'pptx/swimlane-span.js', 'pptx/svg-shapes.js', 'pptx/zip-node.js', 'svg-outline.js', 'lib/emit.js'], draw: true},
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
      import {boxPptx, groupPptx} from 'svg-diagram/pptx/bands/box';
      import {groupSpan} from 'svg-diagram/pptx/bands/group';
      import {box} from 'svg-diagram/bands/box';
      import {group} from 'svg-diagram/bands/group';
      export const draw = () => renderBandsPptx([group(box({title: 'Review'}))], {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
        bands: {box: boxPptx, group: groupPptx}, spans: {group: groupSpan}, strict: true,
      });
    `, include: 'pptx/group-span.js', budget: {esbuild: 147000, Vite: 175000}, bands: ['box.js', 'caption.js', 'group.js'],
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
    {name: 'Composer Canvas', source: composedSource([], "canvas('swot', {strengths: 'Plan'}, {titles: {strengths: 'Review'}})", "import {canvas} from 'svg-diagram/compose/canvas'; "),
      include: 'compose/selective/canvas.js', budget: {esbuild: 81000, Vite: 105000}, bands: ['box.js', 'grid.js'], exclude: [...legacy, 'layout-connect.js', 'bands/banner.js', 'bands/row.js'], draw: true},
    {name: 'Composer Hero', source: composedSource([], "...hero({banner: {headline: 'Review'}, flow: [box({title: 'Step'})], stat: {value: 3, label: 'Done'}})", "import {hero} from 'svg-diagram/compose/hero'; import {box} from 'svg-diagram/bands/box';"),
      include: 'compose/selective/hero.js', budget: {esbuild: 92000, Vite: 118000}, bands: ['banner.js', 'box.js', 'caption.js', 'row.js'], exclude: [...legacy, 'layout-connect.js', 'bands/grid.js', 'bands/group.js'], draw: true},
    {name: 'Composer Icon row', source: composedSource([], "iconRow([{icon: 'check', label: 'Review'}])", "import {iconRow} from 'svg-diagram/compose/icon-row'; import {icon} from 'svg-diagram/bands/box'; icon.has('check'); icon.use({version: 1, icons: {check: {d: 'M2 2h20v20H2z', vb: [0, 0, 24], from: 'file:check.svg', license: 'local'}}});"),
      include: 'compose/selective/icon-row.js', budget: {esbuild: 86000, Vite: 114000}, bands: ['box.js', 'row.js'], exclude: [...legacy, 'layout-connect.js', 'bands/grid.js', 'bands/banner.js'], draw: true},
    {name: 'Composer Versus', source: composedSource([], "...versus({children: box({title: 'Review'})}, {children: box({title: 'Next'})})", "import {versus} from 'svg-diagram/compose/versus'; import {box} from 'svg-diagram/bands/box';"),
      include: 'compose/selective/versus.js', budget: {esbuild: 110000, Vite: 140000}, bands: ['box.js', 'caption.js', 'connect.js', 'group-row.js', 'group.js', 'row.js', 'spacer.js'], exclude: [...legacy, 'bands/banner.js', 'bands/grid.js', 'gantt.js'], draw: true},
    {name: 'Selected pyramid spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {pyramidPart} from 'svg-diagram/spec/parts/pyramid';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'pyramid', layers: ['Review', 'Next']}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [pyramidPart],
      });
    `, include: 'spec-selective.js', budget: {esbuild: 66000, Vite: 88000}, bands: ['pyramid.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/flowchart.js', 'spec-parts/funnel.js', 'spec-parts/r1.js', 'dsl-pure.js', 'layout-connect.js'], draw: true},
    {name: 'Selected table spec', source: `
      import {renderSpec} from 'svg-diagram/spec/selective';
      import {tablePart} from 'svg-diagram/spec/parts/table';
      export const draw = () => renderSpec({version: 1, title: 'Plan', parts: [{type: 'table', columns: [{label: 'Review'}], rows: [['Done']]}]}, {
        measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}), parts: [tablePart],
      });
    `, include: 'spec-parts/selective/table.js', budget: {esbuild: 83000, Vite: 108000}, bands: ['table.js'], exclude: [...legacy, 'lib/spec.js', 'spec-parts/swimlane.js', 'spec-parts/gantt.js', 'dsl-pure.js', 'layout-connect.js'], draw: true},
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
    {name: 'Image', source: composedSource(['image'], "image('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', {alt: 'Picture', width: 240, labels: [{text: 'Review', at: [0.3, 0.5]}]})"),
      include: 'bands/image.js', budget: {esbuild: 68000, Vite: 91000}, exclude: [...legacy, 'dsl/io.js', 'image-file.js', 'charts.js', 'layout-connect.js'], draw: true},
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
    {name: 'Fault tree', source: composedSource([], "faultTree({label: 'Review', gate: 'or', children: [{label: 'Power', kind: 'basic'}, {label: 'Network', kind: 'basic'}]})", "import {faultTree} from 'svg-diagram/bands/fta';"),
      include: 'bands/fta.js', budget: {esbuild: 85000, Vite: 113000}, exclude: [...legacy, 'bowtie.js', 'emit-bowtie.js', 'layout-connect.js', 'dsl/diagrams.js'], draw: true},
    {name: 'Bowtie', source: composedSource(['bowtie'], "bowtie({top: 'Review', threats: [{label: 'Failure'}], consequences: [{label: 'Delay'}]})"),
      include: 'bands/bowtie.js', budget: {esbuild: 73000, Vite: 97000}, exclude: [...legacy, 'fta.js', 'emit-fta.js', 'layout-connect.js', 'dsl/diagrams.js'], draw: true},
    {name: 'Cloud', source: composedSource(['cloud'], "cloud({a: 'Goal', b: 'Quality', c: 'Time', d: 'Test', d2: 'Ship'}, {assumptions: [{on: 'bd', text: 'Review'}]})"),
      include: 'bands/cloud.js', budget: {esbuild: 67000, Vite: 89000}, exclude: [...legacy, 'toc.js', 'layered-route.js', 'cause-hop.js', 'layout-connect.js', 'dsl/diagrams.js'], draw: true},
    {name: 'Classes', source: composedSource([], "classDiagram([{id: 'a', name: 'Review'}, {id: 'b'}], [{from: 'b', to: 'a', kind: 'inherit'}])", "import {classDiagram} from 'svg-diagram/bands/classes';"),
      include: 'bands/classes.js', budget: {esbuild: 142000, Vite: 200000}, exclude: [...legacy, 'bpmn.js', 'bpmn-vertical.js', 'toc.js', 'dsl/diagrams.js', 'layout-connect.js'], draw: true},
    {name: 'BPMN', source: composedSource(['bpmn'], "bpmn([{id: 'work', label: 'Work'}], [{id: 'a', lane: 'work', label: 'Review'}], [])"),
      include: 'bands/bpmn.js', budget: {esbuild: 121000, Vite: 165000}, exclude: [...legacy, 'classes.js', 'toc.js', 'dsl/diagrams.js', 'layout-connect.js'], draw: true},
    {name: 'States', source: composedSource([], "stateDiagram([{id: 'a', label: 'Review'}, {id: 'b', label: 'Done'}], [{from: 'a', to: 'b'}])", "import {stateDiagram} from 'svg-diagram/bands/states';"),
      include: 'bands/states.js', budget: {esbuild: 160000, Vite: 222000}, exclude: [...legacy, 'classes.js', 'bpmn.js', 'toc.js', 'dsl/diagrams.js', 'layout-connect.js'], draw: true},
    {name: 'Tree', source: composedSource(['tree'], "tree({label: 'Review', children: [{label: 'Plan'}, {label: 'Decide'}]})"),
      include: 'bands/tree.js', budget: {esbuild: 89000, Vite: 120000}, exclude: [...legacy, 'states.js', 'toc.js', 'layout-connect.js', 'dsl/diagrams.js', 'layout-row.js', 'layout-grid.js'], draw: true},
    {name: 'Cause', source: composedSource([], "causeTree([{id: 'a', label: 'Review'}, {id: 'b', label: 'Done'}], [{from: 'a', to: 'b'}])", "import {causeTree} from 'svg-diagram/bands/cause';"),
      include: 'bands/cause.js', budget: {esbuild: 166000, Vite: 233000}, exclude: [...legacy, 'cloud.js', 'states.js', 'classes.js', 'dsl/diagrams.js', 'layout-connect.js', 'rca-rules.js'], draw: true},
    {name: 'Swimlane', source: composedSource(['swimlane'], "...swimlane([{id: 'work', label: 'Work'}], [{id: 'a', lane: 'work', title: 'Review'}])"),
      include: 'bands/swimlane.js', budget: {esbuild: 93000, Vite: 121000}, exclude: [...legacy, 'layout-connect.js', 'bands/connect.js', 'seq-table.js', 'wireframe.js', 'layout-row.js'], draw: true,
      bands: ['box.js', 'swimlane.js']},
    {name: 'Radar', source: composedSource(['radar'], "radar(['A', 'B', 'C'], [{label: 'Review', values: [3, 4, 5]}], {max: 5})"),
      include: 'bands/radar.js', budget: {esbuild: 97000, Vite: 120000}, exclude: [...legacy, 'lib/charts.js', 'charts-waterfall.js', 'charts-sankey.js', 'semnet.js', 'layout-connect.js'], draw: true},
    {name: 'Waterfall', source: composedSource(['waterfall'], "waterfall([{label: 'Review', value: 100}, {label: 'Gain', value: 25}])"),
      include: 'bands/waterfall.js', budget: {esbuild: 100000, Vite: 123000}, exclude: [...legacy, 'lib/charts.js', 'charts-radar.js', 'charts-sankey.js', 'semnet.js', 'layout-connect.js'], draw: true},
    {name: 'Sankey', source: composedSource(['sankey'], "sankey(['Review', 'Done'], [{from: 'Review', to: 'Done', value: 5}])"),
      include: 'bands/sankey.js', budget: {esbuild: 105000, Vite: 127000}, exclude: [...legacy, 'lib/charts.js', 'charts-heatmap.js', 'charts-radar.js', 'charts-waterfall.js'], draw: true},
    {name: 'Heatmap', source: composedSource(['heatmap'], "heatmap(['Review', 'Done'], ['A', 'B'], [[1, null], [2, 5]])"),
      include: 'bands/heatmap.js', budget: {esbuild: 96000, Vite: 117000}, exclude: [...legacy, 'lib/charts.js', 'charts-sankey.js', 'charts-radar.js', 'charts-waterfall.js'], draw: true},
    {name: 'Stacked', source: composedSource([], "stackedBars([{label: 'Review', parts: [{label: 'Plan', value: 4}]}])", "import {stackedBars} from 'svg-diagram/bands/stacked';"),
      include: 'bands/stacked.js', budget: {esbuild: 98000, Vite: 121000}, exclude: [...legacy, 'lib/charts.js', 'charts-treemap.js', 'charts-sankey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Treemap', source: composedSource(['treemap'], "treemap({label: 'Review', value: 5})"),
      include: 'bands/treemap.js', budget: {esbuild: 96000, Vite: 118000}, exclude: [...legacy, 'lib/charts.js', 'charts-stacked.js', 'charts-sankey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Harvey', source: composedSource(['harvey'], "harvey(['Review'], ['Plan'], [[4]])"),
      include: 'bands/harvey.js', budget: {esbuild: 96000, Vite: 118000}, exclude: [...legacy, 'lib/charts.js', 'charts-tornado.js', 'charts-butterfly.js', 'charts-bubble.js', 'charts-heatmap.js'], draw: true},
    {name: 'Bubble', source: composedSource(['bubble'], "bubble([{label: 'Review', x: 2, y: 3, size: 5}], {x: {min: 0, max: 4}, y: {min: 0, max: 6}})"),
      include: 'bands/bubble.js', budget: {esbuild: 98000, Vite: 121000}, exclude: [...legacy, 'lib/charts.js', 'charts-tornado.js', 'charts-butterfly.js', 'charts-harvey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Butterfly', source: composedSource(['butterfly'], "butterfly([{label: 'Review', left: 4, right: 5}], {leftLabel: 'Left', rightLabel: 'Right'})"),
      include: 'bands/butterfly.js', budget: {esbuild: 93000, Vite: 114000}, exclude: [...legacy, 'lib/charts.js', 'charts-tornado.js', 'charts-bubble.js', 'charts-harvey.js', 'charts-heatmap.js'], draw: true},
    {name: 'Tornado', source: composedSource(['tornado'], "tornado([{label: 'Review', low: 3, high: 9}], {base: 5})"),
      include: 'bands/tornado.js', budget: {esbuild: 97000, Vite: 118000}, exclude: [...legacy, 'lib/charts.js', 'charts-butterfly.js', 'charts-bubble.js', 'charts-harvey.js', 'charts-heatmap.js'], draw: true},
    {name: 'clustermap', source: composedSource([], "clustermap(['Review', 'Next'], ['A', 'B'], [[1, 3], [4, 2]])", "import {clustermap} from 'svg-diagram/bands/clustermap';"),
      include: 'bands/clustermap.js', budget: {esbuild: 78000, Vite: 98000}, exclude: [...legacy, 'lib/charts.js', 'charts-cat.js', 'charts-dist.js', 'charts-multi.js', 'charts-reg.js'], draw: true},
    {name: 'regplot', source: composedSource([], "regplot({x: [1, 2, 3, 4, 5], y: [2, 5, 5, 7, 9]}, {xLabel: 'Review'})", "import {regplot} from 'svg-diagram/bands/regplot';"),
      include: 'bands/regplot.js', budget: {esbuild: 82000, Vite: 105000}, exclude: [...legacy, 'lib/charts.js', 'charts-cat.js', 'charts-dist.js', 'charts-multi.js', 'charts-cluster.js'], draw: true},
    {name: 'multiplot', source: composedSource([], "hist2d({x: [1, 2, 3, 4], y: [1, 3, 4, 2]}, {xLabel: 'Review'})", "import {hist2d} from 'svg-diagram/bands/multiplot';"),
      include: 'bands/multiplot.js', budget: {esbuild: 88000, Vite: 113000}, exclude: [...legacy, 'lib/charts.js', 'charts-cat.js', 'charts-dist.js', 'charts-reg.js', 'charts-cluster.js'], draw: true},
    {name: 'distplot', source: composedSource([], "histplot([1, 2, 3, 4, 5], {label: 'Review'})", "import {histplot} from 'svg-diagram/bands/distplot';"),
      include: 'bands/distplot.js', budget: {esbuild: 83000, Vite: 104000}, exclude: [...legacy, 'lib/charts.js', 'charts-cat.js', 'charts-multi.js', 'charts-reg.js', 'charts-cluster.js'], draw: true},
    {name: 'catplot', source: composedSource([], "catplot({Review: [1, 2, 3, 4, 5]})", "import {catplot} from 'svg-diagram/bands/catplot';"),
      include: 'bands/catplot.js', budget: {esbuild: 87000, Vite: 111000}, exclude: [...legacy, 'lib/charts.js', 'charts-dist.js', 'charts-multi.js', 'charts-reg.js', 'charts-cluster.js'], draw: true},
    {name: 'dependency', source: composedSource([], "dependencyNetwork([{id: 'a', label: 'Review'}, {id: 'b', label: 'Next'}], [{from: 'a', to: 'b', type: 'uses'}])", "import {dependencyNetwork} from 'svg-diagram/bands/dependency';"),
      include: 'bands/dependency.js', budget: {esbuild: 161000, Vite: 215000}, exclude: [...legacy, 'lib/charts.js', 'semnet.js', 'charts-combo.js', 'charts-compare.js', 'semnet-pert.js', 'semnet-causal.js'], draw: true},
    {name: 'causal', source: composedSource([], "causalLoop([{id: 'a', label: 'Review'}, {id: 'b', label: 'Next'}], [{from: 'a', to: 'b', polarity: '+'}])", "import {causalLoop} from 'svg-diagram/bands/causal';"),
      include: 'bands/causal.js', budget: {esbuild: 172000, Vite: 231000}, exclude: [...legacy, 'lib/charts.js', 'semnet.js', 'charts-combo.js', 'charts-compare.js', 'semnet-pert.js', 'semnet-dependency.js'], draw: true},
    {name: 'pert', source: composedSource([], "pert([{id: 'a', label: 'Review', duration: 2}])", "import {pert} from 'svg-diagram/bands/pert';"),
      include: 'bands/pert.js', budget: {esbuild: 161000, Vite: 215000}, exclude: [...legacy, 'lib/charts.js', 'semnet.js', 'charts-combo.js', 'charts-compare.js', 'semnet-causal.js', 'semnet-dependency.js'], draw: true},
    {name: 'compare', source: composedSource([], "compare(['Review'], ['Plan'], [[['○', 'Ready']]])", "import {compare} from 'svg-diagram/bands/compare';"),
      include: 'bands/compare.js', budget: {esbuild: 94000, Vite: 115000}, exclude: [...legacy, 'lib/charts.js', 'semnet.js', 'charts-combo.js', 'semnet-pert.js', 'semnet-causal.js', 'semnet-dependency.js'], draw: true},
    {name: 'combo', source: composedSource([], "combo(['Review', 'Next'], [{label: 'Plan', type: 'bar', values: [4, 5]}])", "import {combo} from 'svg-diagram/bands/combo';"),
      include: 'bands/combo.js', budget: {esbuild: 102000, Vite: 125000}, exclude: [...legacy, 'lib/charts.js', 'semnet.js', 'charts-compare.js', 'semnet-pert.js', 'semnet-causal.js', 'semnet-dependency.js'], draw: true},
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
        if (name.startsWith('Selective PPTX')) {
          assert.deepEqual(result.fallbacks, [], label);
          assert.equal(result.verdict.ok, true, label);
          const expected = name === 'Selective PPTX Table' ? /<a:tbl>[\s\S]*>Done<\/a:t>/ : /<p:grpSp>[\s\S]*>Review<\/a:t>/;
          assert.match(new TextDecoder().decode(result.pptx), expected, label);
          assert.doesNotMatch(code, /@resvg|HarfBuzz/, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        if (name === 'Selective HTML') {
          assert.match(result.html, /class="sd-b"[\s\S]*>Review<\/div>/, label);
          assert.doesNotMatch(result.html, /<svg|<table/, label);
          assert.doesNotMatch(code, /<table style=/, label);
          assert.deepEqual(result.fallbacks, [], label);
          assert.equal(result.verdict.ok, true, label);
          console.log(`${label}: ${bytes} bytes`);
          continue;
        }
        assert.match(result.svg, name === 'Sankey' ? /<text[^>]*>Review 5<\/text>/ : /<text[^>]*>Review<\/text>/, label);
        if (name === 'Image') {
          assert.match(result.svg, /<image [^>]*href="data:image\/gif;base64,/);
          assert.doesNotMatch(code, /\bBuffer\b/, label);
        }
        if (name === 'Row loop-back') assert.match(result.svg, /Retry/, label);
        assert.deepEqual(result.xml, [], label);
        assert.equal(result.verdict.ok, true, label);
      }
      console.log(`${label}: ${bytes} bytes`);
    }
  }
  async function buildNode(source: string) {
    writeFileSync(entry, source);
    const es = await esbuild({absWorkingDir: consumer, entryPoints: [entry], bundle: true, minify: true,
      platform: 'node', format: 'esm', write: false, metafile: true});
    const ssr = await viteBuild({root: consumer, configFile: false, logLevel: 'silent',
      resolve: {preserveSymlinks: true}, ssr: {noExternal: ['svg-diagram']},
      build: {ssr: entry, write: false, minify: 'esbuild'}});
    const [nodeBundle] = es.outputFiles;
    const [ssrChunk] = ssr.output;
    assert.ok(nodeBundle);
    assert.equal(ssrChunk.type, 'chunk');
    return [
      ['esbuild', Object.keys(es.metafile.inputs), nodeBundle.text],
      ['Vite', Object.keys(ssrChunk.modules), ssrChunk.code],
    ] as const;
  }

  const pictureFile = path.join(consumer, 'picture.gif');
  writeFileSync(pictureFile, Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  const imageCases = await buildNode(composedSource([], `imageFile(${JSON.stringify(pictureFile)}, {alt: 'Picture', width: 240})`,
    "import {imageFile} from 'svg-diagram/bands/image/node';"));
  for (const [bundler, files, code] of imageCases) {
    const label = `${bundler} (Node): Image`;
    const has = (name: string) => files.some(file => file.replaceAll('\\', '/').endsWith('/' + name));
    for (const file of ['bands/image-node.js', 'image-file.js', 'emit-image.js']) assert.ok(has(file), `${label}: missing ${file}`);
    for (const file of [...legacy, 'dsl/io.js', 'layout-connect.js', 'bands/box.js']) assert.ok(!has(file), `${label}: unexpected ${file}`);
    const {draw} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    const result = await draw();
    assert.match(result.svg, /<image [^>]*href="data:image\/gif;base64,/);
    assert.deepEqual(result.xml, []);
    assert.equal(result.verdict.ok, true);
    const bytes = Buffer.byteLength(code);
    assert.ok(bytes <= 70000, `${label}: ${bytes} bytes exceeds 70000`);
    console.log(`${label}: ${bytes} bytes`);
  }

  const mathCases = await buildNode(composedSource(['math'], "math('x^2', {alt: 'Square'})"));
  for (const [bundler, inputs, code] of mathCases) {
    const label = `${bundler} (Node): Math`;
    const files = inputs.map(file => file.replaceAll('\\', '/'));
    assert.ok(files.some(file => file.endsWith('/bands/math.js')), `${label}: missing selective math entry`);
    assert.ok(files.some(file => file.endsWith('/math-tex.js')), `${label}: missing TeX conversion`);
    for (const file of ['dsl/io.js', 'layout-handlers.js', 'verify-handlers.js', 'emit-handlers.js', 'layout-connect.js', 'gantt.js']) {
      assert.ok(!files.some(input => input.endsWith('/' + file)), `${label}: unexpected ${file}`);
    }
    assert.ok(!files.some(file => file.includes('/mathjax-full/')), `${label}: MathJax must be loaded at runtime`);
    const bytes = Buffer.byteLength(code);
    const budget = bundler === 'esbuild' ? 60000 : 85000;
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
