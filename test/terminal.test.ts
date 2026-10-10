import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReplies, supportsSixel, isTmux, fitBox, fitScale, tmuxPassthrough, QUERY} from '../lib/terminal.ts';
import {svgSize} from '../lib/measure.ts';

test('the replies to the combined query are told apart; DA1 ends them', () => {
  const r = parseReplies('\x1b[6;18;9t\x1b[4;900;1800t\x1bP>|WindowsTerminal 1.22\x1b\\\x1b[?61;4;6;22c');
  assert.deepEqual(r.cellPx, {w: 9, h: 18});
  assert.deepEqual(r.windowPx, {w: 1800, h: 900});
  assert.equal(r.version, 'WindowsTerminal 1.22');
  assert.deepEqual(r.da1, [61, 4, 6, 22]);
  assert.equal(r.complete, true);
  assert.equal(supportsSixel(r), true);
  assert.equal(isTmux(r), false);
});

test('tmux answers for itself: DA1 without attribute 4, and XTVERSION names it', () => {
  const r = parseReplies('\x1bP>|tmux 3.3a\x1b\\\x1b[?1;2c');
  assert.equal(supportsSixel(r), false);
  assert.equal(isTmux(r), true);
  assert.equal(r.cellPx, null);
});

test('no answer at all is "no sixel", not a crash', () => {
  const r = parseReplies('');
  assert.equal(r.complete, false);
  assert.equal(supportsSixel(r), false);
  assert.ok(QUERY.endsWith('\x1b[c'), 'DA1 goes last so its reply marks the end');
});

test('the picture is sized to the terminal: cell pixels × columns, else the window, else a guess, else 1200px', () => {
  assert.deepEqual(fitBox({cellPx: {w: 9, h: 18}, cols: 100, rows: 40, windowPx: null}), {maxW: 900, maxH: 3 * 720, estimated: false});
  assert.equal(fitBox({cellPx: null, cols: null, rows: null, windowPx: {w: 1500, h: 800}}).maxW, 1500);
  assert.deepEqual(fitBox({cellPx: null, cols: 80, rows: null, windowPx: null}, {cellWidthGuess: 8}), {maxW: 640, maxH: 3600, estimated: true});
  assert.equal(fitBox(null).maxW, 1200);
});

test('fitScale only shrinks', () => {
  assert.equal(fitScale(940, 700, 1880, 3600), 1);
  assert.equal(fitScale(940, 700, 470, 3600), 0.5);
  assert.equal(fitScale(100, 4000, 1000, 2000), 0.5);
});

test('tmux passthrough doubles every ESC inside the wrapper', () => {
  assert.equal(tmuxPassthrough('\x1bPq#0\x1b\\'), '\x1bPtmux;\x1b\x1bPq#0\x1b\x1b\\\x1b\\');
});

test('svgSize reads width/height, else the viewBox', () => {
  assert.deepEqual(svgSize('<svg xmlns="x" width="940" height="744" viewBox="0 0 940 744"></svg>'), {w: 940, h: 744});
  assert.deepEqual(svgSize('<svg viewBox="0 0 300 200"></svg>'), {w: 300, h: 200});
  assert.equal(svgSize('<svg></svg>'), null);
});
