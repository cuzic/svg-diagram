// `svg-diagram icons`: turning Iconify / .svg bodies into glyphs (pure), and installing from a stand-in Iconify server.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {glyphFromBody, glyphFromSvg, parseManifest, parseSpec} from '../lib/icon-store.ts';
import {addIcons, noticeText, readManifest, removeIcons, setMainSet} from '../lib/icon-install.ts';
import {findIcons, styleOf} from '../lib/icon-find.ts';

const CLI = new URL('../manage-icons.ts', import.meta.url).pathname;
const P = (a: string) => `<path fill="currentColor" d="${a}"/>`;

test('parseSpec: Iconify ids, =name, and .svg files; bad names are refused', () => {
  assert.deepEqual(parseSpec('mdi:key-variant=key'), {kind: 'iconify', prefix: 'mdi', icon: 'key-variant', name: 'key'});
  assert.deepEqual(parseSpec('material-symbols:build'), {kind: 'iconify', prefix: 'material-symbols', icon: 'build', name: 'build'});
  assert.deepEqual(parseSpec('./art/Logo.svg'), {kind: 'file', path: './art/Logo.svg', name: 'Logo'});
  assert.deepEqual(parseSpec('./a.svg=brand'), {kind: 'file', path: './a.svg', name: 'brand'});
  assert.throws(() => parseSpec('key'), /Iconify id/);
  assert.throws(() => parseSpec('mdi:1up'), /usable icon name/);
});

test('glyphFromBody: one filled path keeps the compact d form (evenodd kept); line icons and several parts are kept as a sanitized body', () => {
  assert.deepEqual(glyphFromBody(P('M0 0h8v8z'), {width: 24, height: 24}, 'x'), {d: 'M0 0h8v8z', vb: [0, 0, 24]});
  assert.equal(glyphFromBody('<path fill="currentColor" fill-rule="evenodd" d="M0 0h8v8z"/>', {width: 20}, 'x').rule, 'evenodd');
  const lucide = '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2l-9.6 9.6"/></g>';
  assert.deepEqual(glyphFromBody(lucide, {width: 24}, 'lucide:key'), {vb: [0, 0, 24], body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2l-9.6 9.6"/></g>'});
  const duo = glyphFromBody('<path fill="currentColor" d="M1 1h4v4z" opacity=".2"/><path fill="currentColor" d="M2 2h4v4z"/>', {width: 24}, 'x');
  assert.ok(duo.body && !duo.fixed && duo.d === undefined);
  assert.equal(glyphFromBody('<path fill="none" stroke="currentColor" d="M0 0"/>', {width: 24}, 'x').body, '<path fill="none" stroke="currentColor" d="M0 0"/>');
  assert.deepEqual(glyphFromBody(P('M0 0'), {width: 24, height: 16}, 'x').vb, [0, -4, 24], 'a wide icon is centred in a square');
});

test('glyphFromBody refuses what could carry more than a drawing: scripts, styles, gradients, urls, text, event attributes', () => {
  for (const [body, re] of [
    ['<script>alert(1)</script>', /besides shapes/],
    ['<path d="M0 0" onclick="x"/>', /onclick/],
    ['<path d="M0 0" style="fill:red"/>', /style/],
    ['<linearGradient id="a"/><path d="M0 0"/>', /linearGradient/],
    ['<path fill="url(#a)" d="M0 0"/>', /plain data/],
    ['<g><path d="M0 0"/>hi</g>', /besides shapes/],
    ['<path d="M0 0"', /besides shapes/],
  ] as const) assert.throws(() => glyphFromBody(body, {width: 24}, 'x', {color: true}), re, body);
});

test('colours of their own need --color; they are kept, marked fixed, and #hex only', () => {
  const red = '<circle cx="8" cy="8" r="6" fill="#e53935"/><path fill="currentColor" d="M0 0h2v2z"/>';
  assert.throws(() => glyphFromBody(red, {width: 16}, 'x'), /--color/);
  assert.deepEqual(glyphFromBody(red, {width: 16}, 'x', {color: true}), {vb: [0, 0, 16], body: '<circle cx="8" cy="8" r="6" fill="#e53935"/><path fill="currentColor" d="M0 0h2v2z"/>', fixed: true});
  assert.throws(() => glyphFromBody('<circle r="1" fill="red"/>', {width: 16}, 'x', {color: true}), /named colours/);
});

test('a hand-edited manifest is checked against the same whitelist', () => {
  const ok = {version: 1, icons: {a: {vb: [0, 0, 24], body: '<path d="M0 0" stroke="currentColor"/>', from: 'f', license: 'local'}}};
  assert.ok(parseManifest(JSON.stringify(ok), 'f'));
  assert.throws(() => parseManifest(JSON.stringify({...ok, icons: {a: {...ok.icons.a, body: '<script/>'}}}), 'f'), /not supported/);
  assert.throws(() => parseManifest(JSON.stringify({...ok, icons: {a: {...ok.icons.a, body: '<path d="M0" fill="#f00"/>'}}}), 'f'), /--color/);
  assert.throws(() => parseManifest(JSON.stringify({...ok, icons: {a: {...ok.icons.a, fixed: true}}}), 'f'), /says fixed/);
});

test('glyphFromSvg reads the viewBox (with an origin) and ignores <title>', () => {
  const g = glyphFromSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><title>t</title><path d="M1 1h2z"/></svg>', 'f.svg');
  assert.deepEqual(g, {d: 'M1 1h2z', vb: [0, -960, 960]});
  assert.throws(() => glyphFromSvg('<svg><path d="M1"/></svg>', 'f.svg'), /viewBox/);
});

test('parseManifest refuses anything that is not the file this tool writes', () => {
  assert.throws(() => parseManifest('{}', 'f'), /not an svg-diagram icon file/);
  assert.throws(() => parseManifest('{"version":1,"icons":{"a b":{}}}', 'f'), /bad icon name/);
  assert.throws(() => parseManifest('{"version":1,"icons":{"a":{"d":"M\\"","vb":[0,0,24]}}}', 'f'), /usable path/);
});

// A stand-in for api.iconify.design: /<prefix>.json?icons=a,b and /collections?prefixes=a,b
function iconify() {
  const sets: Record<string, {license: {spdx: string; title: string}; palette?: boolean; width: number; icons: Record<string, object>; aliases?: Record<string, object>}> = {
    mdi: {license: {spdx: 'Apache-2.0', title: 'Apache 2.0'}, width: 24, icons: {key: {body: P('M1 1h4v4z')}, rocket: {body: P('M2 2h4v4z')}, stroke: {body: '<g stroke="currentColor"><path d="M0 0"/></g>'}, flag: {body: '<circle r="2" fill="#f00"/>'}, script: {body: '<script/>'}}, aliases: {'old-key': {parent: 'key'}, flipped: {parent: 'key', hFlip: true}}},
    ccby: {license: {spdx: 'CC-BY-4.0', title: 'CC BY 4.0'}, width: 24, icons: {a: {body: P('M1 1h4v4z')}}},
    color: {license: {spdx: 'MIT', title: 'MIT'}, palette: true, width: 24, icons: {a: {body: P('M1 1h4v4z')}}},
  };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url!, 'http://x');
    res.setHeader('content-type', 'application/json');
    if (u.pathname === '/collections') {
      return void res.end(JSON.stringify(Object.fromEntries(u.searchParams.get('prefixes')!.split(',').filter(p => sets[p]).map(p => [p, {name: 'N', author: {name: 'Someone'}, license: {...sets[p].license, url: 'https://l'}, palette: !!sets[p].palette}]))));
    }
    const s = sets[u.pathname.slice(1).replace(/\.json$/, '')];
    if (!s) { res.statusCode = 404; return void res.end('{}'); }
    res.end(JSON.stringify({prefix: 'x', width: s.width, icons: s.icons, aliases: s.aliases}));
  });
  return new Promise<{api: string; close(): void}>(ok => server.listen(0, '127.0.0.1', () => ok({api: `http://127.0.0.1:${(server.address() as {port: number}).port}`, close: () => server.close()})));
}

test('icons add / remove / notice against a stand-in Iconify: licence, aliases, atomic failure, file install', async () => {
  const srv = await iconify();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
  try {
    fs.writeFileSync(path.join(dir, 'logo.svg'), '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>');
    const r = await addIcons(['mdi:key', 'mdi:old-key=oldkey', './logo.svg'], {api: srv.api, cwd: dir});
    assert.deepEqual(r.added.sort(), ['key', 'logo', 'oldkey']);
    const m = readManifest(path.join(dir, 'svg-diagram.icons.json'));
    assert.deepEqual(m.icons.key, {d: 'M1 1h4v4z', vb: [0, 0, 24], from: 'mdi:key', license: 'Apache-2.0', licenseUrl: 'https://l', author: 'Someone'});
    assert.equal(m.icons.oldkey.d, 'M1 1h4v4z', 'an alias takes its parent\'s path');
    assert.equal(m.icons.logo.license, 'local');
    assert.match(noticeText(m), /mdi — Someone, Apache-2\.0.*: key, oldkey\n- Drawn in this project: logo/);

    const before = fs.readFileSync(path.join(dir, 'svg-diagram.icons.json'), 'utf8');
    await assert.rejects(addIcons(['mdi:rocket', 'mdi:nope'], {api: srv.api, cwd: dir}), /mdi:nope: not in the set/);
    await assert.rejects(addIcons(['mdi:flipped'], {api: srv.api, cwd: dir}), /rotated \/ flipped/);
    await assert.rejects(addIcons(['mdi:script'], {api: srv.api, cwd: dir}), /not supported/);
    await assert.rejects(addIcons(['mdi:flag'], {api: srv.api, cwd: dir}), /--color/);
    await assert.rejects(addIcons(['ccby:a'], {api: srv.api, cwd: dir}), /--allow-license CC-BY-4\.0/);
    await assert.rejects(addIcons(['color:a'], {api: srv.api, cwd: dir}), /multi-colour.*--color/);
    await assert.rejects(addIcons(['mdi:key=a', 'mdi:rocket=a'], {api: srv.api, cwd: dir}), /given twice/);
    assert.equal(fs.readFileSync(path.join(dir, 'svg-diagram.icons.json'), 'utf8'), before, 'a failed add writes nothing');

    assert.deepEqual((await addIcons(['mdi:stroke', 'mdi:flag=red', 'color:a=pal'], {api: srv.api, cwd: dir, color: true})).added.sort(), ['pal', 'red', 'stroke']);
    assert.equal(readManifest(path.join(dir, 'svg-diagram.icons.json')).icons.red.fixed, true);
    removeIcons(['pal', 'red', 'stroke'], dir);
    assert.deepEqual((await addIcons(['ccby:a'], {api: srv.api, cwd: dir, allowLicense: ['CC-BY-4.0']})).added, ['a']);
    assert.deepEqual((await addIcons(['mdi:rocket=key'], {api: srv.api, cwd: dir})).replaced, ['key']);
    assert.deepEqual(removeIcons(['a', 'key'], dir).removed, ['a', 'key']);
    assert.throws(() => removeIcons(['key'], dir), /not installed: key/);
  } finally { srv.close(); fs.rmSync(dir, {recursive: true}); }
});

test('the CLI: add through SVG_DIAGRAM_ICONIFY_API, list, a failure exits 1, and a figure then draws the icon', async () => {
  const srv = await iconify();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-cli-'));
  // asynchronous: a blocking spawnSync would starve the stand-in server living in this process
  const run = (...a: string[]) => new Promise<{code: number | null; out: string; err: string}>(ok => {
    execFile('node', [CLI, ...a], {cwd: dir, env: {...process.env, SVG_DIAGRAM_ICONIFY_API: srv.api}}, (e, out, err) => ok({code: e ? (e as {code?: number}).code ?? 1 : 0, out, err}));
  });
  try {
    const add = await run('add', 'mdi:key=lock2');
    assert.equal(add.code, 0, add.err);
    assert.match(add.out, /追加: lock2/);
    assert.match((await run('list')).out, /lock2\s+mdi:key\s+Apache-2\.0/);
    const bad = await run('add', 'mdi:nope');
    assert.equal(bad.code, 1);
    assert.match(bad.err, /not in the set/);
    assert.equal((await run('bogus')).code, 2);
    // a figure in that directory finds the file from its working directory
    const fig = path.join(dir, 'fig.ts');
    fs.writeFileSync(fig, `import {box, diagram} from ${JSON.stringify(new URL('../lib/dsl.ts', import.meta.url).pathname)};\nexport default () => diagram({theme: 'blue'}).add(box({icon: 'lock2', title: 'x'}));\n`);
    const build = await new Promise<{code: number | null; err: string}>(ok => execFile('node', [new URL('../build-diagram.ts', import.meta.url).pathname, fig, '--out', path.join(dir, 'o.svg'), '--no-lint'], {cwd: dir}, (e, _o, err) => ok({code: e ? 1 : 0, err})));
    assert.equal(build.code, 0, build.err);
    assert.match(fs.readFileSync(path.join(dir, 'o.svg'), 'utf8'), /data-icon="lock2"/);
  } finally { srv.close(); fs.rmSync(dir, {recursive: true}); }
});

// ---- icons find / main ---------------------------------------------------------------------------------------------------
function iconifySearch() {
  const col = (spdx: string, palette = false) => ({name: 'N', author: {name: 'A'}, license: {spdx, title: spdx}, palette});
  const sets: Record<string, Record<string, string>> = {
    mdi: {key: P('M1 1h4v4z'), 'key-plus': P('M2 2h4v4z')},
    lucide: {key: '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M0 0l8 8"/></g>', keys: '<script/>'},
    fa: {key: P('M3 3h4v4z')},
    pal: {key: '<circle r="2" fill="#f00"/>'},
  };
  const lic: Record<string, [string, boolean]> = {mdi: ['Apache-2.0', false], lucide: ['ISC', false], fa: ['CC-BY-4.0', false], pal: ['MIT', true]};
  const server = http.createServer((req, res) => {
    const u = new URL(req.url!, 'http://x');
    res.setHeader('content-type', 'application/json');
    if (u.pathname === '/search') {
      const only = u.searchParams.get('prefixes')?.split(',');
      const ids = ['fa:key', 'lucide:key', 'pal:key', 'lucide:keys', 'mdi:key-plus', 'mdi:key'].filter(id => !only || only.includes(id.split(':')[0]));
      return void res.end(JSON.stringify({icons: ids, collections: Object.fromEntries([...new Set(ids.map(i => i.split(':')[0]))].map(p => [p, col(...lic[p])]))}));
    }
    const s = sets[u.pathname.slice(1).replace(/\.json$/, '')];
    const want = (u.searchParams.get('icons') ?? '').split(',');
    res.end(JSON.stringify({width: 24, icons: Object.fromEntries(want.filter(n => s?.[n]).map(n => [n, {body: s[n]}]))}));
  });
  return new Promise<{api: string; close(): void}>(ok => server.listen(0, '127.0.0.1', () => ok({api: `http://127.0.0.1:${(server.address() as {port: number}).port}`, close: () => server.close()})));
}

test('icons find: licence- and colour-filtered, undrawable icons dropped, the main set first, --style and --set narrow it', async () => {
  const srv = await iconifySearch();
  try {
    const [r] = await findIcons(['key'], {api: srv.api, mainSet: 'mdi'});
    assert.deepEqual(r.candidates.map(c => c.id), ['mdi:key', 'mdi:key-plus', 'lucide:key'], 'main set first, exact name before key-plus; fa (CC-BY), pal (colour) and the script icon are out');
    assert.deepEqual(r.candidates.map(c => c.style), ['fill', 'fill', 'line']);
    assert.deepEqual(r.skipped, ['fa (CC-BY-4.0)']);
    assert.equal(r.candidates[0].add, 'mdi:key=key');
    assert.deepEqual((await findIcons(['key'], {api: srv.api})).at(0)!.candidates.map(c => c.id), ['lucide:key', 'mdi:key', 'mdi:key-plus'], 'with no main set: exact names in search order');
    assert.deepEqual((await findIcons(['key'], {api: srv.api, mainSet: 'mdi', style: 'line'}))[0].candidates.map(c => c.id), ['lucide:key']);
    assert.deepEqual((await findIcons(['key'], {api: srv.api, sets: ['lucide']}))[0].candidates.map(c => c.id), ['lucide:key']);
    assert.deepEqual((await findIcons(['key'], {api: srv.api, allowLicense: ['CC-BY-4.0'], limit: 9}))[0].candidates.map(c => c.id).includes('fa:key'), true);
    assert.equal((await findIcons(['key'], {api: srv.api, color: true, limit: 9}))[0].candidates.find(c => c.id === 'pal:key')?.style, 'color');
    assert.deepEqual(styleOf({vb: [0, 0, 24], d: 'M0 0'}), 'fill');
    await assert.rejects(findIcons([' '], {api: srv.api}), /empty word/);
  } finally { srv.close(); }
});

test('the first set installed becomes the main set; another set warns; icons main sets and clears it', async () => {
  const srv = await iconify();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-main-'));
  try {
    const first = await addIcons(['mdi:key'], {api: srv.api, cwd: dir});
    assert.deepEqual(first.warnings, []);
    const file = path.join(dir, 'svg-diagram.icons.json');
    assert.equal(readManifest(file).mainSet, 'mdi');
    const other = await addIcons(['ccby:a=x'], {api: srv.api, cwd: dir, allowLicense: ['CC-BY-4.0']});
    assert.match(other.warnings[0], /主セットは mdi。ccby/);
    assert.equal(readManifest(file).mainSet, 'mdi', 'adding from another set does not move it');
    assert.equal(setMainSet('ccby', dir).mainSet, 'ccby');
    assert.equal(readManifest(file).mainSet, 'ccby');
    setMainSet(undefined, dir);
    assert.equal(readManifest(file).mainSet, undefined);
    assert.throws(() => setMainSet('Not A Set', dir), /not an Iconify set prefix/);
    assert.equal(readManifest(file).icons.key.from, 'mdi:key', 'the icons are kept');
  } finally { srv.close(); fs.rmSync(dir, {recursive: true}); }
});

test('the CLI: icons find prints candidates with the add line and writes the picture', async () => {
  const srv = await iconifySearch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-find-'));
  try {
    fs.writeFileSync(path.join(dir, 'svg-diagram.icons.json'), JSON.stringify({version: 1, mainSet: 'mdi', icons: {}}));
    const r = await new Promise<{code: number; out: string; err: string}>(ok => execFile('node', [CLI, 'find', 'key', '--png', path.join(dir, 's.png')], {cwd: dir, env: {...process.env, SVG_DIAGRAM_ICONIFY_API: srv.api}}, (e, out, err) => ok({code: e ? 1 : 0, out, err})));
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /主セット: mdi/);
    assert.match(r.out, /mdi:key\s+fill\s+Apache-2\.0\s+★主セット\n\s+→ svg-diagram icons add mdi:key=key/);
    assert.match(r.out, /ライセンスのため除外: fa \(CC-BY-4\.0\)/);
    assert.deepEqual([...fs.readFileSync(path.join(dir, 's.png')).subarray(1, 4)], [80, 78, 71], 'a PNG was written');
  } finally { srv.close(); fs.rmSync(dir, {recursive: true}); }
});
