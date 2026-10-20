// ADR 0022 U2: gantt({today: 'auto'}) takes the day the caller gives (--today, SVG_DIAGRAM_TODAY, .svg-diagram.json "today"); the clock is never read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const run = (script: string, cwd: string, args: string[], env: Record<string, string> = {}) => {
  const base = {...process.env}; delete base['SVG_DIAGRAM_TODAY'];
  return spawnSync(process.execPath, [path.join(ROOT, script), ...args], {cwd, encoding: 'utf8', env: {...base, ...env}});
};
const build = (cwd: string, args: string[], env?: Record<string, string>) => run('build-diagram.ts', cwd, args, env);
const check = (cwd: string, args: string[], env?: Record<string, string>) => run('check-diagram.ts', cwd, args, env);
const out = (r: ReturnType<typeof run>) => `${r.stdout}\n${r.stderr}`;
const src = (today: string) => `import {diagram, gantt} from 'svg-diagram';
export default () => diagram({theme: 'blue', title: '予定'}).add(gantt([{label: '設計', start: '2026-10-05', end: '2026-10-30'}], {today: '${today}'}));
`;
const project = (config?: object) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gantt-today-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'auto.ts'), src('auto'));
  fs.writeFileSync(path.join(dir, 'src', 'fixed.ts'), src('2026-10-19'));
  if (config) fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify(config));
  return dir;
};
const svgOf = (dir: string, name: string) => fs.readFileSync(path.join(dir, 'svg', `${name}.svg`), 'utf8');
const meta = (svg: string) => JSON.parse(/<metadata id="svg-diagram">(.*?)<\/metadata>/s.exec(svg)![1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
const noMeta = (svg: string) => svg.replace(/<metadata[\s\S]*?<\/metadata>/, '');

test("today: 'auto' with no date given fails and says how to give one", () => {
  const dir = project();
  const r = build(dir, ['src/auto.ts']);
  assert.notEqual(r.status, 0);
  assert.match(out(r), /today: 'auto' needs a date.*--today.*SVG_DIAGRAM_TODAY/s);
  assert.equal(fs.existsSync(path.join(dir, 'svg', 'auto.svg')), false);
});

test("--today builds the same figure as writing the date; only 'auto' leaves the day in the metadata", () => {
  const dir = project();
  assert.equal(build(dir, ['src/auto.ts', 'src/fixed.ts', '--today', '2026-10-19']).status, 0);
  assert.equal(noMeta(svgOf(dir, 'auto')), noMeta(svgOf(dir, 'fixed')));
  assert.equal(meta(svgOf(dir, 'auto')).today, '2026-10-19');
  assert.equal('today' in meta(svgOf(dir, 'fixed')), false);
  assert.equal(build(dir, ['src/auto.ts', '--today', '2026-10-12']).status, 0);
  assert.notEqual(noMeta(svgOf(dir, 'auto')), noMeta(svgOf(dir, 'fixed')), 'another day moves the line');
});

test('the day comes from --today, then SVG_DIAGRAM_TODAY, then .svg-diagram.json', () => {
  const dir = project({today: '2026-10-08'});
  const day = (r: ReturnType<typeof run>) => { assert.equal(r.status, 0, out(r)); return meta(svgOf(dir, 'auto')).today; };
  assert.equal(day(build(dir, ['src/auto.ts'])), '2026-10-08');
  assert.equal(day(build(dir, ['src/auto.ts'], {SVG_DIAGRAM_TODAY: '2026-10-09'})), '2026-10-09');
  assert.equal(day(build(dir, ['src/auto.ts', '--today', '2026-10-10'], {SVG_DIAGRAM_TODAY: '2026-10-09'})), '2026-10-10');
});

test('a bad date is refused, whichever way it was given', () => {
  const dir = project();
  assert.match(out(build(dir, ['src/auto.ts', '--today', '10/19'])), /--today must be a real date/);
  assert.match(out(build(dir, ['src/auto.ts', '--today', 'now'])), /--today must be a real date/);
  assert.match(out(build(dir, ['src/auto.ts', '--today', '2026-02-30'])), /--today must be a real date/);
  assert.match(out(build(dir, ['src/auto.ts'], {SVG_DIAGRAM_TODAY: 'tomorrow'})), /SVG_DIAGRAM_TODAY must be a real date/);
  const bad = project({today: 'soon'});
  assert.match(out(build(bad, ['src/auto.ts'])), /"today" must be a real date/);
});

test("check takes --today too, and check --drift --rebuild redraws with the metadata's day (an other SVG_DIAGRAM_TODAY does not matter)", () => {
  const dir = project();
  assert.equal(build(dir, ['src/auto.ts', '--today', '2026-10-19']).status, 0);
  const none = check(dir, ['src/auto.ts']);
  assert.notEqual(none.status, 0);
  assert.match(out(none), /today: 'auto' needs a date/);
  const ok = check(dir, ['src/auto.ts', '--today', '2026-10-19']);
  assert.equal(ok.status, 0, out(ok));
  const drift = check(dir, ['--drift', '--rebuild', 'src/auto.ts'], {SVG_DIAGRAM_TODAY: '2030-01-01'});
  assert.equal(drift.status, 0, out(drift));
});
