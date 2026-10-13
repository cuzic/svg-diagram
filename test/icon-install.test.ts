// `svg-diagram icons`: turning Iconify / .svg bodies into glyphs (pure), and installing from a stand-in Iconify server.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {ICON_NAME_RE, glyphFromBody, glyphFromSvg, parseManifest, parseSpec, prefixIds, sanitizeBody} from '../lib/icon-store.ts';
import {addIcons, addSet, noticeText, readManifest, removeIcons, setMainSet, withManifestLock} from '../lib/icon-install.ts';
import type {Fetch} from '../lib/icon-install.ts';
import {ICON_SETS, setArgs} from '../lib/icon-sets.ts';
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
    ['<script>alert(1)</script>', /<script> is not supported/],
    ['<path d="M0 0" onclick="x"/>', /onclick/],
    ['<path d="M0 0" style="fill:red"/>', /style/],
    ['<mask id="a"/><path d="M0 0"/>', /<mask> is not supported/],
    ['<filter id="a"/><path d="M0 0"/>', /<filter>/],
    ['<text>x</text>', /<text> is not supported/],
    ['<text/>', /<text>/],
    ['<path fill="url(#a)" d="M0 0"/>', /does not define/],
    ['<linearGradient id="a"/><path stroke-width="url(#a)" d="M0 0"/>', /only url\(#id\)/],
    ['<use href="https://x/y.svg#a"/>', /<use>/],
    ['<linearGradient id="a" href="http://evil/x"/><path fill="url(#a)" d="M0 0"/>', /inside the icon/],
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

test('gradients and clip paths defined inside the icon are kept (colour: --color), their ids are checked, and unreferenced ids dropped', () => {
  const g = '<defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><clipPath id="c1"><rect width="24" height="24"/></clipPath></defs><g clip-path="url(#c1)"><rect id="Icon-Arch/48/x" width="24" height="24" fill="url(#g1)"/></g>';
  assert.throws(() => glyphFromBody(g, {width: 24}, 'azure:x'), /--color/);
  const r = glyphFromBody(g, {width: 24}, 'azure:x', {color: true});
  assert.equal(r.fixed, true);
  assert.ok(r.body!.includes('<linearGradient id="g1"') && r.body!.includes('fill="url(#g1)"') && !r.body!.includes('Icon-Arch'));
  assert.equal(prefixIds(r.body!, 'p-').match(/p-g1/g)!.length, 2, 'the id and its url() both get the prefix');
  assert.ok(prefixIds(r.body!, 'p-').includes('clip-path="url(#p-c1)"'));
  assert.ok(sanitizeBody('<path d="M0 0" fill="currentColor" data-x="1" inkscape:label="a"/>', 'x', false, true).body.includes('d="M0 0"'), 'a file\'s editor leftovers are dropped');
  assert.throws(() => sanitizeBody('<path d="M0 0" data-x="1"/>', 'x', false), /data-x/, 'but an Iconify body or a manifest is strict');
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

// ---- vendor packs (add-pack) ---------------------------------------------------------------------------------------------
import {addPack} from '../lib/icon-pack.ts';
import {packIconName} from '../lib/icon-store.ts';

const AWS_SVG = (fill: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="48px" height="48px" viewBox="0 0 48 48" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><title>Icon-Architecture/48/Arch_AWS-Lambda_48</title><g id="Icon-Architecture/48/Arch_AWS-Lambda_48" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="Icon-Architecture-BG/48/Compute" fill="${fill}"><rect id="Rectangle" x="0" y="0" width="48" height="48"/></g><path d="M10,10 L38,10 L24,38 Z" id="Amazon-Lambda_Icon_48_Squid" fill="#FFFFFF"/></g></svg>`;

test('packIconName: vendor file names become short kebab names under the prefix', () => {
  assert.equal(packIconName('Arch_Compute/48/Arch_AWS-Lambda_48.svg', 'aws'), 'aws-lambda');
  assert.equal(packIconName('Res_Amazon-EC2_Instance_48_Dark.svg', 'aws'), 'aws-amazon-ec2-instance-dark');
  assert.equal(packIconName('10021-icon-service-Virtual-Machine.svg', 'azure'), 'azure-virtual-machine');
  assert.equal(packIconName('Cloud Run.svg', 'gcp'), 'gcp-cloud-run');
  assert.equal(packIconName('3d.svg', 'x'), 'x-3d');
});

test('add-pack: needs the vendor terms said and accepted, installs the best size per icon, records the terms, and reports what it cannot take', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-src-'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-proj-'));
  try {
    const put = (rel: string, text: string) => { fs.mkdirSync(path.dirname(path.join(src, rel)), {recursive: true}); fs.writeFileSync(path.join(src, rel), text); };
    put('Arch_Compute/48/Arch_AWS-Lambda_48.svg', AWS_SVG('#ED7100'));
    put('Arch_Compute/64/Arch_AWS-Lambda_64.svg', AWS_SVG('#000000'));
    put('Arch_Storage/48/Arch_Amazon-Simple-Storage-Service_48.svg', AWS_SVG('#7AA116'));
    put('Arch_Odd/48/Arch_Styled_48.svg', '<svg viewBox="0 0 48 48"><style>.a{fill:red}</style><rect class="a" width="48" height="48"/></svg>');
    put('readme.txt', 'not an icon');
    assert.throws(() => addPack(src, {prefix: 'aws', cwd: dir, all: true}), /vendor's own terms/);
    assert.throws(() => addPack(src, {prefix: 'aws', cwd: dir, all: true, terms: 'https://aws.amazon.com/architecture/icons/'}), /--accept-terms|own terms/);
    assert.throws(() => addPack(src, {prefix: 'aws', cwd: dir, terms: 'u', acceptTerms: true}), /4 icons.*--match.*--all/s);
    assert.throws(() => addPack(src, {prefix: 'AWS', cwd: dir, list: true}), /--prefix/);
    const listed = addPack(src, {prefix: 'aws', cwd: dir, list: true});
    assert.deepEqual(listed.added, ['aws-amazon-simple-storage-service', 'aws-lambda']);
    assert.equal(fs.existsSync(path.join(dir, 'svg-diagram.icons.json')), false, '--list writes nothing');
    const r = addPack(src, {prefix: 'aws', cwd: dir, all: true, terms: 'https://aws.amazon.com/architecture/icons/', acceptTerms: true, today: '2026-10-12'});
    assert.deepEqual(r.added, ['aws-amazon-simple-storage-service', 'aws-lambda']);
    assert.deepEqual(Object.keys(r.skipped).map(k => k.slice(0, 26)), ['<style> is not supported (']);
    assert.deepEqual(Object.values(r.skipped), [['Arch_Odd/48/Arch_Styled_48.svg']]);
    assert.match(r.collisions[0], /aws-lambda \(2 files: .*48.* kept\)/);
    const m = readManifest(path.join(dir, 'svg-diagram.icons.json'));
    assert.deepEqual(m.packs, {aws: {terms: 'https://aws.amazon.com/architecture/icons/', source: path.basename(src), acceptedAt: '2026-10-12'}});
    const l = m.icons['aws-lambda'];
    assert.deepEqual([l.license, l.fixed, l.vb], ['vendor:aws', true, [0, 0, 48]]);
    assert.ok(l.body!.includes('fill="#ED7100"') && !l.body!.includes('Icon-Architecture') && !l.body!.includes('Rectangle'), 'the Arch_ 48 px file won; ids that nothing refers to are gone');
    assert.match(noticeText(m), /aws — the vendor's own terms \(https:\/\/aws\.amazon\.com\/architecture\/icons\/\), accepted 2026-10-12: aws-amazon-simple-storage-service, aws-lambda/);
    assert.throws(() => parseManifest(JSON.stringify({...m, packs: {aws: {terms: ''}}}), 'f'), /bad pack/);
    const again = addPack(src, {prefix: 'aws', cwd: dir, match: /Lambda/, terms: 't', acceptTerms: true});
    assert.deepEqual([again.added, again.replaced], [[], ['aws-lambda']]);
  } finally { fs.rmSync(src, {recursive: true}); fs.rmSync(dir, {recursive: true}); }
});

test('parallel `icons add` runs against one manifest lose no update, and leave no lock or temp file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-par-'));
  try {
    const N = 8;
    for (let i = 0; i < N; i++) fs.writeFileSync(path.join(dir, `p${i}.svg`), `<svg viewBox="0 0 10 10"><path d="M0 0h${i + 1}v10z"/></svg>`);
    const run = (...a: string[]) => new Promise<{code: number; err: string}>(ok => execFile('node', [CLI, ...a], {cwd: dir}, (e, _o, err) => ok({code: e ? 1 : 0, err})));
    const rs = await Promise.all(Array.from({length: N}, (_, i) => run('add', `./p${i}.svg`)));
    for (const r of rs) assert.equal(r.code, 0, r.err);
    const m = readManifest(path.join(dir, 'svg-diagram.icons.json'));
    assert.deepEqual(Object.keys(m.icons).sort(), Array.from({length: N}, (_, i) => `p${i}`));
    assert.deepEqual(fs.readdirSync(dir).filter(f => /\.(lock|tmp)$/.test(f)), []);
  } finally { fs.rmSync(dir, {recursive: true}); }
});

test('a lock left by a dead process is taken over; a live one makes the run wait', {timeout: 60000}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-lock-'));
  try {
    const file = path.join(dir, 'svg-diagram.icons.json');
    fs.writeFileSync(`${file}.lock`, '2147483646\n'); // no such process
    assert.equal(withManifestLock(file, () => 'ok'), 'ok');
    assert.equal(fs.existsSync(`${file}.lock`), false);
    assert.throws(() => withManifestLock(file, () => withManifestLock(file, () => 1)), /held by another/);
  } finally { fs.rmSync(dir, {recursive: true}); }
});

test('icons sets: every curated id is an mdi icon with a usable short name, and add-set installs through addIcons', async () => {
  assert.ok(Object.keys(ICON_SETS).includes('accounting'));
  assert.ok(Object.keys(ICON_SETS.accounting.icons).length >= 30);
  for (const [n, s] of Object.entries(ICON_SETS)) for (const [name, id] of Object.entries(s.icons)) {
    assert.match(id, /^mdi:[a-z0-9-]+$/, `${n}/${name}`);
    assert.match(name, ICON_NAME_RE, `${n}/${name}`);
  }
  assert.throws(() => setArgs('nope'), /no icon set "nope"/);
  const asked: string[] = [];
  const fetchFake: Fetch = async url => {
    asked.push(url);
    const u = new URL(url);
    if (u.pathname === '/collections') return {ok: true, status: 200, json: async () => ({mdi: {author: {name: 'P'}, license: {spdx: 'Apache-2.0', url: 'https://l'}}})};
    const icons = Object.fromEntries(decodeURIComponent(u.searchParams.get('icons')!).split(',').map(i => [i, {body: '<path fill="currentColor" d="M1 1h4v4z"/>'}]));
    return {ok: true, status: 200, json: async () => ({prefix: 'mdi', width: 24, height: 24, icons})};
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-set-'));
  try {
    const r = await addSet('accounting', {fetch: fetchFake, cwd: dir});
    assert.equal(r.added.length, Object.keys(ICON_SETS.accounting.icons).length);
    const m = readManifest(path.join(dir, 'svg-diagram.icons.json'));
    assert.equal(m.icons.receipt.from, 'mdi:receipt-text');
    assert.equal(m.icons.receipt.license, 'Apache-2.0');
    assert.equal(m.mainSet, 'mdi');
    assert.match(noticeText(m), /mdi — P, Apache-2\.0/);
  } finally { fs.rmSync(dir, {recursive: true}); }
});
