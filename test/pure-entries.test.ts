// ADR 0031 §4: the whole pipeline over the example figures, asked for what a pure core must give: the same input draws the same output
// whatever was drawn before (no state leaks between renders), every SVG is well-formed XML, and the stages after the pre-layout passes
// never write into what they are handed (the data goes in frozen; a write would throw).
import {test} from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {layoutDiagram} from '../lib/layout-measured.ts';
import {runPreLayout, runPostLayout} from '../lib/pipeline.ts';
import {verifyDiagram} from '../lib/verify.ts';
import {emitSvg} from '../lib/emit.ts';
import {emitHtml} from '../lib/emit-html.ts';
import {fontBoxOf} from '../lib/font-box.ts';
import {xmlProblems} from '../lib/xml-check.ts';
import {closeMeasurer} from '../lib/measure.ts';
import type {LaidOutDiagram} from '../lib/types/index.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'
test.after(() => closeMeasurer());

const EXAMPLES = fs.readdirSync('examples').filter(f => f.endsWith('.ts')).sort().map(f => path.resolve('examples', f));
const name = (abs: string): string => path.basename(abs, '.ts');
const load = (abs: string) => loadDiagram(abs, loadConfig(path.dirname(abs)));
const draw = async (abs: string) => { const r = await renderDiagram(await load(abs), {name: name(abs) + '.svg', budget: 'cacheOnly'}); return {svg: r.svg, xml: r.xml}; };

test('an example draws the same however many other figures were drawn before it, and its SVG is well-formed', async () => {
  const first = new Map<string, string>();
  for (const abs of EXAMPLES) { const r = await draw(abs); assert.deepEqual(r.xml, [], `${name(abs)}: well-formed`); first.set(abs, r.svg); }
  for (const abs of [...EXAMPLES].reverse()) assert.equal((await draw(abs)).svg, first.get(abs), `${name(abs)}: drawn again after all the others, in the opposite order`);
});

/** Freeze plain objects and arrays all the way down. Functions, Maps, Sets and class instances (the handles of raw()) are left alone. */
function deepFreeze<T>(v: T, seen = new Set<object>()): T {
  if (typeof v !== 'object' || v === null || seen.has(v)) return v;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return v;
  seen.add(v);
  for (const k of Reflect.ownKeys(v)) deepFreeze((v as Record<PropertyKey, unknown>)[k], seen);
  return Object.freeze(v);
}

test('after the pre-layout passes nothing writes into its input: layout, the post-layout passes, verify and both emitters accept frozen data', async () => {
  for (const abs of EXAMPLES) {
    const prepared = deepFreeze(runPreLayout({...await load(abs)})); // the pre-layout passes write into their input: renderDiagram hands them a copy
    const laid = await layoutDiagram(prepared);
    const post = deepFreeze(runPostLayout(laid));
    const where = name(abs);
    assert.doesNotThrow(() => verifyDiagram(post), `${where}: verify`);
    assert.doesNotThrow(() => emitSvg(post), `${where}: emitSvg`);
    if (post.appearance !== 'auto') assert.doesNotThrow(() => emitHtml(post as LaidOutDiagram, {fontBox: fontBoxOf(post.measure)}), `${where}: emitHtml`);
  }
});
