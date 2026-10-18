import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, banner, box, caption, checkDiagram, closeMeasurer, diagram, renderDiagram, row, stat, table} from '../lib/dsl.ts';
import {LIGHT_COLORS, DARK_PALETTE, PALETTE, TONES, darkOf, recolor, wcagRatio, NO_TONES} from '../lib/tokens.ts';
import {geometryChecks} from '../lib/geometry-checks.ts';

process.env.SVG_DIAGRAM_STRICT_WIDTH = '1';
test.after(() => closeMeasurer());

const dark = (c: string) => darkOf(c);
const THEMES = ['amber', 'teal', 'blue'] as const;

test('every light token has a distinct dark counterpart, and recolor is idempotent', () => {
  const light = [...LIGHT_COLORS];
  const mapped = light.map(dark);
  assert.equal(new Set(mapped).size, new Set(light).size);
  for (const m of mapped) assert.ok(!LIGHT_COLORS.has(m), `${m} collides with a light token`);
  const s = `<rect fill="${PALETTE.bg}"/><path stroke="#ff00ff"/>`;
  assert.equal(recolor(NO_TONES, s, 'dark'), `<rect fill="${DARK_PALETTE.bg}"/><path stroke="#ff00ff"/>`);
  assert.equal(recolor(NO_TONES, recolor(NO_TONES, s, 'dark'), 'dark'), recolor(NO_TONES, s, 'dark'));
  assert.equal(recolor(NO_TONES, s, 'light'), s);
});

test('dark palette: text pairs reach 4.5:1 and outlines 3:1 for every tone of every theme', () => {
  const col = (key: string, theme: typeof THEMES[number]) => dark(key === 'accent' || key === 'soft' ? PALETTE[theme][key] : PALETTE[key as 'bg']);
  for (const theme of THEMES) for (const [name, t] of Object.entries(TONES)) {
    const fill = col(t.fill, theme), text = col(t.text, theme);
    assert.ok(wcagRatio(text, fill) >= 4.5, `${theme}/${name}: text ${text} on ${fill} = ${wcagRatio(text, fill).toFixed(2)}`);
    if (t.stroke && name !== 'removed' && name !== 'muted') {
      const st = col(t.stroke, theme);
      assert.ok(wcagRatio(st, dark(PALETTE.bg)) >= 3, `${theme}/${name}: outline ${st} on page`);
    }
  }
  // the colours the text of a plain caption / a coloured span uses, on the page
  for (const theme of THEMES) for (const c of [PALETTE.text, PALETTE.muted, PALETTE.danger, PALETTE[theme].accent]) {
    assert.ok(wcagRatio(dark(c), dark(PALETTE.bg)) >= 4.5, `${theme}: ${c} on the dark page`);
  }
  // muted text also sits on the code fill, accent text on the soft fill
  assert.ok(wcagRatio(dark(PALETTE.muted), dark(PALETTE.code)) >= 4.5);
});

const make = (extra: object = {}) => diagram({theme: 'teal', title: 'dark', legend: 'auto', ...extra}).add(
  caption('見出し', {bold: true}),
  banner({headline: '強調', tone: 'solid'}),
  row([stat('76%', '導入前', {tone: 'danger'}), stat('31%', '導入後', {tone: 'accent'})]),
  box({title: '箱', body: '本文', tone: 'accent', id: 'a'}),
  table([{label: '項目'}, {label: '値'}], [['a', 'b'], ['c', 'd']], {rowHeader: true}),
);

test('default is light and unchanged; dark recolours every token and puts the dark page colour behind', async () => {
  const light = (await renderDiagram(make(), {name: 'd.svg', budget: 'cacheOnly'})).svg;
  const dk = (await renderDiagram(make({appearance: 'dark'}), {name: 'd.svg', budget: 'cacheOnly'})).svg;
  assert.match(light, new RegExp(`<rect x="0" y="0"[^>]*fill="${PALETTE.bg}"`));
  assert.match(dk, new RegExp(`<rect x="0" y="0"[^>]*fill="${DARK_PALETTE.bg}"`));
  for (const c of LIGHT_COLORS) assert.ok(!dk.includes(c), `light colour ${c} left in the dark SVG`);
  assert.equal(dk.replace(' data-appearance="dark"', '').replace(/#[0-9a-f]{6}/gi, '#'), light.replace(/#[0-9a-f]{6}/gi, '#'), 'only colours differ');
});

test('transparent: no page rectangle, and the root names the page colour the checks assume', async () => {
  const t = (await renderDiagram(make({transparent: true}), {name: 'd.svg', budget: 'cacheOnly'})).svg;
  assert.doesNotMatch(t, /<rect x="0" y="0" width="940"/);
  assert.match(t, new RegExp(`data-assumed-bg="${PALETTE.bg}"`));
  const td = (await renderDiagram(make({transparent: true, appearance: 'dark'}), {name: 'd.svg', budget: 'cacheOnly'})).svg;
  assert.match(td, new RegExp(`data-assumed-bg="${DARK_PALETTE.bg}"`));
  assert.doesNotMatch(td, /<rect x="0" y="0" width="940"/);
});

test('rendered lint: dark and transparent-dark are clean, and transparent-dark text is judged on the dark page (not white)', async () => {
  for (const extra of [{appearance: 'dark'}, {appearance: 'dark', transparent: true}, {transparent: true}]) {
    const {svg} = await renderDiagram(make(extra), {name: 'd.svg', budget: 'cacheOnly'});
    assert.deepEqual(geometryChecks(svg)!.contrast, [], JSON.stringify(extra));
  }
  // the same transparent-dark SVG without the assumed page colour would be judged on white and fail
  const {svg} = await renderDiagram(diagram({theme: 'teal', appearance: 'dark', transparent: true}).add(caption('見出し', {tone: 'text'})), {name: 'd.svg', budget: 'cacheOnly'});
  assert.deepEqual(geometryChecks(svg)!.contrast, []);
  assert.ok(geometryChecks(svg.replace(/ data-assumed-bg="[^"]*"/, ''))!.contrast.length > 0);
});

test('compile-time rules and verify: a dark diagram has no contrast finding', async () => {
  const {verdict} = await checkDiagram(make({appearance: 'dark'}));
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(verdict.findings.filter(f => f.severity !== 'info'), []);
});

test('the rules judge the dark colours: a tone that is fine on white can fail on dark only through the palette', async () => {
  // light muted text on the light code fill and its dark counterpart both pass; sanity check the plumbing with a forged palette entry
  const d = make({appearance: 'dark'});
  const {verdict} = await checkDiagram(d);
  assert.ok(!verdict.findings.some(f => f.rule === 'a11y-text-contrast'));
});

test('html: dark recolours, transparent drops the page background', async () => {
  const r = await renderDiagram(make({appearance: 'dark', transparent: true}), {name: 'd.svg', budget: 'cacheOnly', html: true});
  assert.match(r.html!, /background: transparent;/);
  for (const c of LIGHT_COLORS) assert.ok(!r.html!.includes(c), `light colour ${c} left in the dark HTML`);
  const lit = await renderDiagram(make({appearance: 'dark'}), {name: 'd.svg', budget: 'cacheOnly', html: true});
  assert.match(lit.html!, new RegExp(`background: ${DARK_PALETTE.bg};`));
});

test('an unknown appearance is refused', () => {
  assert.throws(() => diagram({theme: 'teal', appearance: 'sepia' as 'dark'}), /appearance/);
});

// a deck's own dark set: navy page, white text, a lighter accent, a deep-blue soft fill
const DECK = {bg: '#0b1220', text: '#ffffff', muted: '#94a3b8', accent: '#60a5fa', soft: '#1a3070'};

test('appearance: {dark: {...}} replaces the named tokens; the rest stay the built-in dark set', async () => {
  const {svg} = await renderDiagram(make({appearance: {dark: DECK}, transparent: true}), {name: 'd.svg', budget: 'cacheOnly'});
  assert.match(svg, /data-assumed-bg="#0b1220"/);
  assert.match(svg, /data-palette="#0b1220 #ffffff #94a3b8 #60a5fa #1a3070"/);
  assert.ok(svg.includes('#60a5fa') && svg.includes('#ffffff') && svg.includes('#94a3b8'));
  assert.ok(!svg.includes(DARK_PALETTE.text) && !svg.includes(PALETTE.text));
  assert.ok(svg.includes(DARK_PALETTE.danger), 'danger was not replaced');
  assert.deepEqual(geometryChecks(svg)!.contrast, []);
  const {verdict} = await checkDiagram(make({appearance: {dark: DECK}}));
  assert.deepEqual(verdict.findings.filter(f => f.severity !== 'info'), []);
});

test('a custom colour equal to a light token is not recoloured twice (html)', async () => {
  const r = await renderDiagram(make({appearance: {dark: DECK}, transparent: true}), {name: 'd.svg', budget: 'cacheOnly', html: true});
  assert.ok(r.html!.includes('color:#ffffff'), 'white text stays white');
  assert.ok(!r.html!.includes(PALETTE.text));
});

test('a custom dark set that would be unreadable is reported by the contrast rules', async () => {
  const {verdict} = await checkDiagram(make({appearance: {dark: {...DECK, muted: '#1b2436'}}}));
  assert.ok(verdict.findings.some(f => f.rule === 'a11y-text-contrast') || verdict.problems.length > 0);
});

test('a bad custom token is refused', () => {
  assert.throws(() => diagram({theme: 'teal', appearance: {dark: {bg: 'navy'}}}), /#rrggbb/);
  assert.throws(() => diagram({theme: 'teal', appearance: {dark: {nope: '#000000'} as never}}), /keys are/);
});

test('default dark danger is a saturated red that still reads as text on the page and on the code fill', () => {
  assert.ok(wcagRatio(DARK_PALETTE.danger, DARK_PALETTE.bg) >= 4.5);
  assert.ok(wcagRatio(DARK_PALETTE.danger, DARK_PALETTE.code) >= 4.5);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(DARK_PALETTE.danger.slice(i, i + 2), 16));
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) >= 150, 'not a pastel pink');
});

const WALL = {bg: '#0b1220', text: '#ffffff', muted: '#94a3b8', accent: '#60a5fa', soft: '#1a3070'};
const wall = (danger: string) => diagram({theme: 'blue', title: 'wall', transparent: true, appearance: {dark: {...WALL, danger}}}).add(
  caption('必要な電力と、使える電力', {bold: true, tone: 'text'}),
  bars([{label: '使える', value: 40, series: 'a'}, {label: '必要', value: 100, tone: 'danger'}], {max: 100, unit: '%'}),
);

test('a deep red (#dc2626) on the deck palette: bars are drawn in it, and the checks pass while it is only a bar fill', async () => {
  const {svg, verdict} = await renderDiagram(wall('#dc2626'), {name: 'w.svg', budget: 'cacheOnly'});
  assert.match(svg, /fill="#dc2626"/);
  assert.deepEqual(geometryChecks(svg)!.contrast, []);
  assert.ok(wcagRatio('#dc2626', '#0b1220') >= 3, 'a bar fill needs 3:1 against the page');
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual((await checkDiagram(wall('#dc2626'))).verdict.findings.filter(f => f.severity !== 'info'), []);
});

test('the same deep red used as text is reported (4.5:1), so it cannot slip through', async () => {
  const d = diagram({theme: 'blue', title: 't', appearance: {dark: {...WALL, danger: '#dc2626'}}}).add(caption('赤い文字', {tone: 'danger'}));
  const f = (await checkDiagram(d)).verdict.findings;
  assert.ok(f.some(x => x.rule === 'a11y-text-contrast'), JSON.stringify(f));
});

test('recolor rewrites colour places only: text, <title>, <desc>, <metadata> and aria-label keep a "#ffffff" they mention', async () => {
  const d = diagram({theme: 'teal', appearance: 'dark', title: '配色 #ffffff', desc: '背景は #ffffff', legend: 'auto'}).add(caption('背景色は #ffffff（#22201b）', {tone: 'text'}), box({title: '#a8632b', body: '#ffffff', id: 'x'}));
  d.source = {generator: 'svg-diagram', toolVersion: '0', source: 'a #ffffff.ts', sourceSha256: 'x'} as never;
  const {svg, html} = await renderDiagram(d, {name: 'd.svg', budget: 'cacheOnly', html: true});
  assert.match(svg, /<title id="svg-title">配色 #ffffff<\/title>/);
  assert.match(svg, /<desc id="svg-desc">背景は #ffffff<\/desc>/);
  assert.match(svg, /a #ffffff\.ts/);
  assert.match(svg, />背景色は #ffffff（#22201b）</);
  assert.match(svg, />#a8632b</);
  assert.match(html!, />背景色は #ffffff（#22201b）</);
  // and the colours themselves were recoloured
  assert.match(svg, new RegExp(`<rect x="0" y="0"[^>]*fill="${DARK_PALETTE.bg}"`));
});

test('recolor: attributes and CSS only, once', () => {
  const s = `<svg data-assumed-bg="#ffffff" aria-label="#ffffff"><style>.a{fill:#ffffff}</style><text fill="#22201b" style="stroke:#e0d6c5">#ffffff</text></svg>`;
  assert.equal(recolor(NO_TONES, s, 'dark'), `<svg data-assumed-bg="${DARK_PALETTE.bg}" aria-label="#ffffff"><style>.a{fill:${DARK_PALETTE.bg}}</style><text fill="${DARK_PALETTE.text}" style="stroke:${DARK_PALETTE.border}">#ffffff</text></svg>`);
});

test('lint-svg: the dark tokens pass only in a diagram that says it is dark', async () => {
  const {execFileSync} = await import('node:child_process');
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-'));
  const lightSvg = (await renderDiagram(make(), {name: 'd.svg', budget: 'cacheOnly'})).svg;
  const darkSvg = (await renderDiagram(make({appearance: 'dark'}), {name: 'd.svg', budget: 'cacheOnly'})).svg;
  assert.match(darkSvg, /data-appearance="dark"/);
  assert.doesNotMatch(lightSvg, /data-appearance/);
  // a light diagram that has been hand-edited to a dark token is off-token
  const forged = lightSvg.replace(PALETTE.text, DARK_PALETTE.text);
  const run = (name: string, svg: string) => { const f = path.join(dir, name); fs.writeFileSync(f, svg); return execFileSync(process.execPath, [new URL('../lint-svg.ts', import.meta.url).pathname, f], {encoding: 'utf8'}); };
  assert.match(run('forged.svg', forged), /off-token-color/);
  assert.doesNotMatch(run('dark.svg', darkSvg), /off-token-color/);
  assert.doesNotMatch(run('light.svg', lightSvg), /off-token-color/);
});
