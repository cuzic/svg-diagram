// ADR 0071: the JSON Schema files in schema/ are the ones lib/schema-files.ts makes, a standard validator reads them, and they agree with
// the CLIs' own checks on what a shape can say (and every file may name its schema with "$schema").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Ajv} from 'ajv';
import {schemaFiles, schemaText} from '../lib/schema-files.ts';
import {partCatalog, validateSpec} from '../lib/spec.ts';
import {validateDeck} from '../lib/deck-spec.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {parseSite} from '../lib/site.ts';
import {readConfigFile} from '../lib/config.ts';

const ROOT = path.join(import.meta.dirname, '..');
const files = schemaFiles();
const ajv = new Ajv({strict: true, allErrors: true, strictTypes: false});
const validators = Object.fromEntries(Object.entries(files).map(([name, s]) => [name.replace('.schema.json', ''), ajv.compile(s)]));
const valid = (kind: string, value: unknown): boolean => (validators[kind] as (v: unknown) => boolean)(value);
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-schema-'));

const STEPS = [{label: '計画'}, {label: '実装'}, {label: '検証'}];
const SPEC = {version: 1, title: '手順', parts: [{type: 'chevron', steps: STEPS}]};

test('schema/ holds exactly the files lib/schema-files.ts makes (run `pnpm schema` after changing a schema)', () => {
  const dir = path.join(ROOT, 'schema');
  assert.deepEqual(fs.readdirSync(dir).sort(), Object.keys(files).sort());
  for (const [name, schema] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(dir, name), 'utf8'), schemaText(schema), `schema/${name} is stale`);
});

test('the package ships schema/ and exports its files', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {files: string[]; exports: Record<string, unknown>};
  assert.ok(pkg.files.includes('schema'));
  assert.equal(pkg.exports['./schema/*.json'], './schema/*.json');
});

test('spec: every catalog example is valid, as the CLI finds it; "$schema" is allowed at the top', () => {
  for (const {type, example} of partCatalog()) {
    const spec = {$schema: './node_modules/svg-diagram/schema/spec.schema.json', version: 1, title: type, parts: [example]};
    assert.ok(valid('spec', spec), `${type}: ${JSON.stringify(validators['spec']?.errors?.slice(0, 3))}`);
  }
});

test('spec: what the schema can say, it refuses as the CLI does', () => {
  const bad: unknown[] = [
    {...SPEC, colour: 'red'}, // unknown field
    {...SPEC, version: 2},
    {version: 1, parts: SPEC.parts}, // no title
    {...SPEC, theme: 'pink'},
    {...SPEC, parts: []},
    {...SPEC, parts: [{type: 'nope'}]},
    {...SPEC, parts: [{type: 'chevron', steps: [...STEPS, {label: '公開', colour: 'red'}]}]},
    {...SPEC, width: 200},
  ];
  for (const spec of bad) {
    assert.ok(validateSpec(spec).length > 0, `the CLI takes ${JSON.stringify(spec)}`);
    assert.equal(valid('spec', spec), false, `the schema takes ${JSON.stringify(spec)}`);
  }
  assert.deepEqual(validateSpec(SPEC), []);
  assert.ok(valid('spec', SPEC));
});

test('deck: a figure is a spec (without canvas) or the path of a .ts / .json figure, in a slide and in a column', () => {
  const deck = {
    $schema: './node_modules/svg-diagram/schema/deck.schema.json',
    title: 'デッキ',
    slides: [
      {layout: 'cover', title: '表紙', presenter: '発表者'},
      {title: '図', figure: SPEC},
      {title: 'ファイル', figure: 'flow.diagram.ts'},
      {title: '段', columns: [{figure: 'a.json'}, {figure: SPEC, caption: '右'}, {text: '・要点'}]},
    ],
  };
  assert.ok(valid('deck', deck), JSON.stringify(validators['deck']?.errors?.slice(0, 3)));
  const {$schema: _s, ...inline} = deck;
  assert.deepEqual(validateDeck({...inline, slides: inline.slides.filter(s => typeof s.figure !== 'string' && !s.columns)}), []);
  for (const wrong of [
    {slides: []},
    {slides: [{title: 'x', colour: 'red'}]},
    {slides: [{figure: {...SPEC, canvas: {width: 1920}}}]},
    {slides: [{figure: 'flow.svg'}]},
    {slides: [{columns: [{figure: SPEC}, {figure: {...SPEC, theme: 'pink'}}]}]},
  ]) assert.equal(valid('deck', wrong), false, `the schema takes ${JSON.stringify(wrong)}`);
});

test('deck: the CLIs read a deck and a .json figure that name their schema', () => {
  const dir = tmp();
  try {
    fs.writeFileSync(path.join(dir, 'fig.json'), JSON.stringify({$schema: './spec.schema.json', ...SPEC}));
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({$schema: './deck.schema.json', slides: [{title: 'a', figure: 'fig.json'}, {title: 'b', figure: SPEC}]}));
    const got = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(got.ok, got.ok ? '' : got.errors.join('\n'));
    assert.equal(Object.hasOwn(got.loaded.deck, '$schema'), false);
    assert.deepEqual(got.loaded.deck.slides[0]?.figure, SPEC);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('site.json: the schema and parseSite agree; "$schema" is allowed', () => {
  const site = {$schema: './node_modules/svg-diagram/schema/site.schema.json', title: '資料', decks: [{deck: 'a/deck.json', slug: 'a-1', title: 'A'}], extra: {CNAME: 'CNAME'}};
  assert.ok(valid('site', site));
  assert.ok(parseSite(site, '/p/site.json').ok);
  for (const wrong of [{decks: []}, {decks: [{slug: 'x'}]}, {decks: [{deck: 'a.json', slug: 'Bad Slug'}]}, {decks: [{deck: 'a.json'}], colour: 'red'}, {$schema: 1, decks: [{deck: 'a.json'}]}]) {
    assert.equal(valid('site', wrong), false, `the schema takes ${JSON.stringify(wrong)}`);
    assert.equal(parseSite(wrong, '/p/site.json').ok, JSON.stringify(wrong).includes('Bad Slug'), `parseSite on ${JSON.stringify(wrong)}`); // a slug's form is checked later, by assignSlugs
  }
});

test('.svg-diagram.json: the schema takes what readConfigFile takes, and refuses its typos', () => {
  const config = {
    $schema: './node_modules/svg-diagram/schema/config.schema.json',
    outDir: 'images', maxWidth: 940, legend: 'auto', wrap: 'bunsetsu', keepWords: true, measure: 'font', fontFloor: 12, today: '2026-11-20',
    accept: {'a11y-text-contrast': '印刷しない図なので'}, terms: {ユーザー: ['利用者']}, legendLabels: {'tone:accent': '注意'},
    tones: {accent: {fill: '#e6d3bd', dark: {fill: '#4a3a28'}}}, fonts: {sans: {regular: 'fonts/a.ttf', bold: 'fonts/b.ttf#1'}},
  };
  assert.ok(valid('config', config), JSON.stringify(validators['config']?.errors?.slice(0, 3)));
  const dir = tmp();
  try {
    const f = path.join(dir, '.svg-diagram.json');
    fs.writeFileSync(f, JSON.stringify(config));
    assert.equal(readConfigFile(f).outDir, 'images');
    for (const wrong of [
      {accept: {'no-such-rule': 'x'}}, {accept: {'a11y-text-contrast': ''}}, {legend: true}, {legendLabels: {'tone:pink': 'x'}},
      {tones: {pink: {fill: '#ffffff'}}}, {tones: {accent: {fill: 'red'}}}, {wrap: 'word'}, {keepWords: 'yes'}, {fontFloor: 16}, {today: 'tomorrow'}, {outDir: ''},
    ]) {
      fs.writeFileSync(f, JSON.stringify(wrong));
      assert.throws(() => readConfigFile(f), Error, `readConfigFile takes ${JSON.stringify(wrong)}`);
      assert.equal(valid('config', wrong), false, `the schema takes ${JSON.stringify(wrong)}`);
    }
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  assert.equal(valid('config', {outDir: 'svg', colour: 'red'}), false); // readConfigFile leaves an unknown field alone; the editor names it
});
