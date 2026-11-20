// ADR 0071: the JSON Schema files in schema/ are the ones lib/schema-files.ts makes, a standard validator reads them, and they agree with
// the CLIs' own checks on what a shape can say (and every file may name its schema with "$schema").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Ajv} from 'ajv';
import {EDITOR_KEYWORDS, schemaFiles, schemaText} from '../lib/schema-files.ts';
import {partCatalog, validateSpec, withoutSchemaField} from '../lib/spec.ts';
import {validateDeck} from '../lib/deck-spec.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {parseSite} from '../lib/site.ts';
import {readConfigFile} from '../lib/config.ts';

const ROOT = path.join(import.meta.dirname, '..');
const files = schemaFiles();
const ajv = new Ajv({strict: true, allErrors: true, strictTypes: false});
ajv.addVocabulary([...EDITOR_KEYWORDS]);
for (const [name, s] of Object.entries(files)) ajv.addSchema(s as object, name); // deck and figure point at spec.schema.json, as an editor resolves them next to each other
const validators = Object.fromEntries(Object.keys(files).map(name => [name.replace('.schema.json', ''), ajv.getSchema(name) as ReturnType<Ajv['compile']>]));
const valid = (kind: string, value: unknown): boolean => (validators[kind] as (v: unknown) => boolean)(value);
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-schema-'));

const STEPS = [{label: '計画'}, {label: '実装'}, {label: '検証'}];
const SPEC = {version: 1, title: '手順', parts: [{type: 'chevron', steps: STEPS}]};

test('withoutSchemaField takes out a string $schema at the top only, and leaves anything else for the checks to name', () => {
  assert.deepEqual(withoutSchemaField({$schema: './deck.schema.json', slides: []}), {slides: []});
  const kept = {$schema: 1, slides: []};
  assert.equal(withoutSchemaField(kept), kept);
  for (const v of [null, 'x', [{$schema: 'a'}], {slides: [{$schema: 'a'}]}]) assert.equal(withoutSchemaField(v), v);
});

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
  assert.deepEqual(validateSpec({$schema: './spec.schema.json', ...SPEC}), [], 'a spec file read with the public API may name its schema too');
  assert.ok(validateSpec({$schema: 1, ...SPEC}).some(i => i.path === '$schema'));
});

test('parts are read by type first: every part type (with what it is for), then that part\'s fields alone (if / then, no oneOf)', () => {
  type Items = {properties: {type: {enum: string[]; enumDescriptions: string[]}}; allOf: {if: unknown; then: {$ref: string}}[]; oneOf?: unknown; defaultSnippets: {label: string; body: unknown}[]};
  const spec = files['spec.schema.json'] as {properties: {parts: {$ref: string}}; definitions: {parts: {items: Items}} & Record<string, {description?: string}>};
  const items = spec.definitions.parts.items, types = partCatalog().map(p => p.type);
  assert.equal(spec.properties.parts.$ref, '#/definitions/parts');
  assert.deepEqual(items.properties.type.enum, types);
  assert.deepEqual(items.properties.type.enumDescriptions, partCatalog().map(p => p.description));
  assert.equal(items.oneOf, undefined);
  assert.deepEqual(items.allOf.map(b => b.then.$ref), types.map(t => `#/definitions/part.${t}`));
  assert.deepEqual(items.defaultSnippets.map(x => x.label), types);
  for (const t of types) assert.ok(spec.definitions[`part.${t}`]?.description, t);
  for (const name of ['figure.schema.json', 'deck.schema.json']) assert.match(JSON.stringify(files[name]), /"\$ref":"spec\.schema\.json#\/definitions\/parts"/, name);
});

test('spec: a one-line text that is blank or holds a line break is refused, as the CLI refuses it', () => {
  for (const label of ['   ', 'a\nb', 'a\tb']) {
    const spec = {...SPEC, parts: [{type: 'chevron', steps: [...STEPS, {label}]}]};
    assert.ok(validateSpec(spec).length > 0, JSON.stringify(label));
    assert.equal(valid('spec', spec), false, JSON.stringify(label));
  }
  assert.ok(valid('spec', {...SPEC, title: '日本語と English、記号 ①→②'}));
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
      {title: '段', columns: [{figure: 'a.json'}, {figure: SPEC, caption: '右'}, {text: '・要点\n・次の点'}], notes: '話すこと\n\t- 補足'},
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
    {slides: [{figure: 'a.json.bak'}]},
    {slides: [{figure: 'a.ts.svg'}]},
    {slides: [{title: '一行目\n二行目'}]},
    {slides: [{title: 'a', notes: '   '}]},
    {slides: [{title: 'a', notes: 'ベル\u0007'}]},
    {slides: [{columns: [{figure: SPEC}, {figure: {...SPEC, theme: 'pink'}}]}]},
  ]) assert.equal(valid('deck', wrong), false, `the schema takes ${JSON.stringify(wrong)}`);
});

test('a .json figure of a deck: the spec without canvas', () => {
  assert.ok(valid('figure', {$schema: './figure.schema.json', ...SPEC}));
  assert.ok(valid('spec', {...SPEC, canvas: {width: 1920}}));
  assert.equal(valid('figure', {...SPEC, canvas: {width: 1920}}), false);
  assert.equal(valid('figure', {...SPEC, parts: [{type: 'chevron', steps: STEPS, colour: 'red'}]}), false);
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
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({$schema: 1, slides: [{title: 'a'}]}));
    const wrong = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(!wrong.ok && wrong.errors.some(e => e.startsWith('$schema')), 'a $schema that is not a string is an unknown field, as in site.json');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('site.json: the schema and parseSite agree; "$schema" is allowed', () => {
  const site = {$schema: './node_modules/svg-diagram/schema/site.schema.json', title: '資料', decks: [{deck: 'a/deck.json', slug: 'a-1', title: 'A'}], extra: {CNAME: 'CNAME'}};
  assert.ok(valid('site', site));
  assert.ok(parseSite(site, '/p/site.json').ok);
  // [site.json, what parseSite says]: a slug's form and the reserved names are checked later (assignSlugs), the editor says so at once
  for (const [wrong, parsed] of [
    [{decks: []}, false], [{decks: [{slug: 'x'}]}, false], [{decks: [{deck: 'a.json'}], colour: 'red'}, false], [{$schema: 1, decks: [{deck: 'a.json'}]}, false],
    [{decks: [{deck: 'a.json', slug: 'Bad Slug'}]}, true], [{decks: [{deck: 'a.json', slug: 'assets'}]}, true],
  ] as const) {
    assert.equal(valid('site', wrong), false, `the schema takes ${JSON.stringify(wrong)}`);
    assert.equal(parseSite(wrong, '/p/site.json').ok, parsed, `parseSite on ${JSON.stringify(wrong)}`);
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
