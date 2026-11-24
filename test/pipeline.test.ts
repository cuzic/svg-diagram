import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PIPELINE_ORDER, POST_LAYOUT_STAGES, PRE_LAYOUT_STAGES} from '../lib/pipeline.ts';

// The order is load-bearing (see the comments in lib/pipeline.ts): changing it is a decision, so it is pinned.
test('the render pipeline runs its stages in this order', () => {
  assert.deepEqual([...PIPELINE_ORDER], ['loop-back', 'reveal', 'auto-legend', 'layout', 'spotlight', 'verify', 'emit', 'xml']);
  assert.deepEqual(PRE_LAYOUT_STAGES.map(s => s.name), ['loop-back', 'reveal', 'auto-legend']);
  assert.deepEqual(POST_LAYOUT_STAGES.map(s => s.name), ['spotlight']);
});

test('the shared pipeline runs injected stages without the full browser renderer', async () => {
  const {createPipeline} = await import('../lib/pipeline-core.ts');
  const calls: string[] = [];
  const pipeline = createPipeline({
    preLayout: [{name: 'prepare', run: d => { calls.push('prepare'); return d; }}],
    postLayout: [{name: 'finish', run: d => { calls.push('finish'); return d; }}],
    verify: () => { calls.push('verify'); return {ok: true, problems: [], warnings: [], findings: []}; },
    emit: (_d, opts) => { calls.push(`emit:${opts.reveal ?? 'final'}`); return '<svg xmlns="http://www.w3.org/2000/svg"/>'; },
  });
  const input = {} as Parameters<typeof pipeline.runPreLayout>[0];
  const output = {} as Parameters<typeof pipeline.runPostLayout>[0];
  const checked = await pipeline.runChecked(input, async prepared => {
    assert.equal(prepared, input);
    calls.push('layout');
    return output;
  });
  assert.equal(checked.laidOut, output);
  assert.deepEqual(pipeline.emitOutputs(output, {reveal: 2}).xml, []);
  assert.match(pipeline.emitRevealStage(output, 0), /^<svg/);
  assert.deepEqual(calls, ['prepare', 'layout', 'finish', 'verify', 'emit:2', 'emit:0']);
});

test('the shared pipeline bundles without legacy stage implementations', async () => {
  const {build} = await import('esbuild');
  const {fileURLToPath} = await import('node:url');
  const {metafile} = await build({entryPoints: [fileURLToPath(new URL('../lib/pipeline-core.ts', import.meta.url))],
    bundle: true, platform: 'browser', write: false, metafile: true});
  const forbidden = ['/rules.ts', '/reveal.ts', '/spotlight.ts', '/verify.ts', '/emit.ts', '/loop-back.ts'];
  assert.deepEqual(Object.keys(metafile.inputs).filter(file => forbidden.some(suffix => file.endsWith(suffix))), []);
});
