import assert from 'node:assert/strict';
import {test} from 'node:test';
import {balloonPath, balloonRadius, type BalloonKind} from '../lib/comic/balloon-path.ts';
import {balloonOutline, cloudPolygon, cloudRadii, cloudTextRect, officeAdj} from '../lib/shapes/balloon.ts';
import type {Balloon, BalloonOpts, BalloonShape, Pt, Rect} from '../lib/shapes/balloon.ts';
import {balloonPath as referencePath, balloonRadius as referenceRadius} from './helpers/balloon-path-ref.ts';
import {officeWedges} from './helpers/office-wedge.ts';

const shapes: BalloonShape[] = ['rect', 'round', 'ellipse', 'cloud'];

function random(seed: number) {
  return (min: number, max: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return min + (max - min) * seed / 2 ** 32;
  };
}

const center = (b: Rect): Pt => [b.x + b.w / 2, b.y + b.h / 2];
const distance = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

function near(actual: number, expected: number, tolerance: number): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected} (tolerance ${tolerance})`);
}

function nearPoint(actual: Pt, expected: Pt, tolerance: number): void {
  near(distance(actual, expected), 0, tolerance);
}

function finite(outline: Balloon): void {
  // JSON serialization alone would turn non-finite numbers into null.
  const json = JSON.stringify(outline, (_, value: unknown) => typeof value === 'number' ? String(value) : value);
  assert.doesNotMatch(json, /NaN|Infinity/);
}

test('comic wrapper matches the original d and base for 6000 seeded inputs', () => {
  const rnd = random(438);
  const kinds: BalloonKind[] = ['say', 'think', 'shout'];
  let narrowed = 0;
  for (let i = 0; i < 6000; i++) {
    const kind = kinds[i % kinds.length]!;
    const body = {x: rnd(-50, 50), y: rnd(-50, 50), w: rnd(60, 300), h: rnd(30, 128)};
    const {w, h} = body;
    const radius = referenceRadius(kind, h);
    assert.equal(balloonRadius(kind, h), radius);
    assert.ok(w >= 2 * radius && h >= 2 * radius);
    const [cx, cy] = center(body);
    const tipCase = Math.floor(i / kinds.length) % 12;
    const tip: Pt = tipCase === 0 ? [Infinity, cy] : tipCase === 1 ? [cx, cy] : [cx + rnd(-1.8, 1.8) * w, cy + rnd(-1.8, 1.8) * h];
    const tail = i % 4 === 0 ? {tip, halfWidth: rnd(2, 22)} : {tip};
    if (tipCase > 1) assert.notEqual(Math.abs(tip[1] - cy) * w, Math.abs(tip[0] - cx) * h, 'random input should not be a diagonal tie');
    const original = referencePath(body, kind, tail);
    assert.deepEqual(balloonPath(body, kind, tail), original, `case ${i} (${kind})`);
    if (original.base && distance(...original.base) < 2 * (tail.halfWidth ?? 8) - 0.1) narrowed++;
  }
  assert.ok(narrowed > 0, 'covers drawable narrow wedges');
});

test('comic diagonal ties switch from top/bottom to left/right', () => {
  const cases = [
    {body: {x: 20, y: 30, w: 200, h: 100}, tip: [320, 180], side: 'right', oldY: 130, newX: 220},
    {body: {x: 20, y: 30, w: 240, h: 60}, tip: [-100, 0], side: 'left', oldY: 30, newX: 20},
  ] as const;
  for (const {body, tip, side, oldY, newX} of cases) {
    const old = referencePath(body, 'say', {tip});
    const fresh = balloonPath(body, 'say', {tip});
    assert.notEqual(fresh.d, old.d);
    assert.ok(old.base?.every(p => p[1] === oldY));
    assert.ok(fresh.base?.every(p => p[0] === newX));
    assert.equal(balloonOutline('round', body, tip, {radius: 24, halfWidth: 8}).side, side);
    for (const delta of [-0.001, 0.001]) {
      const offDiagonal = {tip: [tip[0], tip[1] + delta] as const};
      assert.deepEqual(balloonPath(body, 'say', offDiagonal), referencePath(body, 'say', offDiagonal));
    }
  }
});

test('comic clamps a shout radius that does not fit the body', () => {
  const body = {x: 0, y: 0, w: 100, h: 8};
  assert.match(referencePath(body, 'shout').d, /A6 6/);
  assert.match(balloonPath(body, 'shout').d, /A4 4/);
});

test('comic narration ignores a supplied tail', () => {
  const body = {x: 0, y: 0, w: 100, h: 80};
  assert.deepEqual(balloonPath(body, 'narration', {tip: [50, 150]}), referencePath(body, 'narration'));
});

test('outline properties across 1600 seeded shapes, sizes and tails', () => {
  const rnd = random(77);
  for (const shape of shapes) for (const radius of [0, 8, 40, 500]) for (const base of ['follow', 'office'] as const) {
    for (let i = 0; i < 50; i++) {
      const body = {x: rnd(-100, 100), y: rnd(-100, 100), w: rnd(40, 400), h: rnd(24, 200)};
      const {x, y, w, h} = body;
      const [cx, cy] = center(body);
      const tip: Pt = [cx + rnd(-w, w), cy + rnd(-h, h)];
      const opts: BalloonOpts = {radius, base, halfWidth: rnd(2, 40)};
      const outline = balloonOutline(shape, body, tip, opts);
      assert.match(outline.d, /^M.*Z$/);
      assert.equal(outline.d, balloonOutline(shape, body, tip, opts).d);
      finite(outline);
      if (!outline.base) continue;
      const [a, b] = outline.base;
      if (shape === 'ellipse') {
        for (const p of outline.base) near(((p[0] - cx) / (w / 2)) ** 2 + ((p[1] - cy) / (h / 2)) ** 2, 1, 1e-6);
        assert.ok(distance(a, b) <= Math.max(w, h) * Math.sin(11 * Math.PI / 180) + 1e-9);
      } else if (shape !== 'cloud') {
        const margin = Math.max(4, shape === 'round' ? Math.min(radius, w / 2, h / 2) : 0);
        const alongX = outline.side === 'top' || outline.side === 'bottom';
        const edge = outline.side === 'top' ? y : outline.side === 'bottom' ? y + h : outline.side === 'left' ? x : x + w;
        const start = alongX ? x : y, sideLength = alongX ? w : h;
        for (const p of outline.base) {
          near(p[alongX ? 1 : 0], edge, 0.1);
          const along = p[alongX ? 0 : 1];
          assert.ok(along >= start + margin - 0.05 - 1e-9 && along <= start + sideLength - margin + 0.05 + 1e-9);
        }
        const half = Math.min(base === 'office' ? sideLength / 8 : opts.halfWidth!, (sideLength - 2 * margin) / 2);
        assert.ok(distance(a, b) <= 2 * half + 0.1 + 1e-9);
      }
      if (distance(tip, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) >= 8) assert.ok(outline.length > 0);
    }
  }
});

test('degenerate tips, corner cutouts, radii and narrow sides', () => {
  const small = {x: 0, y: 0, w: 60, h: 30};
  for (const shape of shapes) for (const radius of [0, 8, 40, 500]) {
    const noTip = balloonOutline(shape, small, undefined, {radius});
    for (const tip of [[NaN, 300], [100, Infinity], [-Infinity, NaN]] as const) {
      assert.deepEqual(balloonOutline(shape, small, tip, {radius}), noTip);
    }
    const inside = balloonOutline(shape, small, center(small), {radius});
    assert.equal(inside.inside, true);
    assert.equal(inside.base, undefined);
    assert.equal(inside.dots, undefined);
    finite(inside);
    finite(balloonOutline(shape, small, [30, 300], {radius, halfWidth: 500}));
  }
  assert.match(balloonOutline('round', small).d, /A5 5/);
  assert.match(balloonOutline('round', small, undefined, {radius: 500}).d, /A15 15/);
  const body = {x: 0, y: 0, w: 200, h: 100};
  const inside = balloonOutline('round', body, [100, 50], {radius: 24, halfWidth: 8});
  assert.equal(inside.inside, true);
  assert.equal(inside.base, undefined);
  const cutout = balloonOutline('round', body, [1, 1], {radius: 24});
  assert.equal(cutout.inside, true);
  assert.equal(cutout.base, undefined);
  assert.equal(balloonOutline('round', body, [100, 0], {radius: 24}).inside, false);
  assert.equal(balloonPath(body, 'say', {tip: [100, 50]}).base, undefined);
  assert.equal(balloonPath(body, 'say', {tip: [NaN, 300]}).base, undefined);
  assert.equal(balloonPath({...body, w: 40}, 'say', {tip: [20, 300]}).base, undefined);
  assert.deepEqual(balloonPath({...body, w: 60}, 'say', {tip: [30, 300]}).base, [[36, 100], [24, 100]]);
  assert.deepEqual(balloonOutline('rect', body, [202, -100]).base, [[168, 0], [196, 0]]);
  assert.deepEqual(balloonOutline('rect', {...body, w: 60}, [30, 300], {halfWidth: 500}).base, [[56, 100], [4, 100]]);
  assert.equal(balloonOutline('rect', {...body, w: 9}, [4.5, 300]).base, undefined);
  assert.equal(balloonOutline('rect', body, [100, 300], {halfWidth: -1}).base, undefined);
});

test('coordinate and option limits report the offending argument', () => {
  const body = {x: -1e6, y: -1e6, w: 1e6, h: 1e6};
  for (const shape of shapes) {
    finite(balloonOutline(shape, body, [1e6, 1e6], {radius: 1e6, halfWidth: 1e6}));
    finite(balloonOutline(shape, {x: 0, y: 0, w: Number.MIN_VALUE, h: Number.MIN_VALUE}, [1, 1]));
  }
  for (const [name, value, draw] of [
    ['body.x', -1000001, () => balloonOutline('rect', {...body, x: -1000001})],
    ['body.y', NaN, () => balloonOutline('round', {...body, y: NaN})],
    ['body.w', 0, () => balloonOutline('ellipse', {...body, w: 0})],
    ['body.h', 1000001, () => balloonOutline('cloud', {...body, h: 1000001})],
    ['tip[0]', 1000001, () => balloonOutline('rect', body, [1000001, 0])],
    ['tip[1]', -1000001, () => balloonOutline('rect', body, [0, -1000001])],
    ['radius', -1000001, () => balloonOutline('round', body, undefined, {radius: -1000001})],
    ['halfWidth', Infinity, () => balloonOutline('rect', body, undefined, {halfWidth: Infinity})],
  ] as const) {
    assert.throws(draw, err => err instanceof RangeError && err.message.includes(name) && err.message.includes(String(value)));
  }
});

function essentialVertices(points: Pt[]): Pt[] {
  const distinct = points.filter((point, i) => distance(point, points[(i + points.length - 1) % points.length]!) > 1e-7);
  return distinct.filter(([x, y], i) => {
    const [ax, ay] = distinct[(i + distinct.length - 1) % distinct.length]!;
    const [bx, by] = distinct[(i + 1) % distinct.length]!;
    return Math.abs((x - ax) * (by - y) - (y - ay) * (bx - x)) > 1e-6;
  });
}

function rectangularVertices(d: string): Pt[] {
  let x = 0, y = 0;
  const vertices: Pt[] = [];
  for (const [, op, first, second] of d.matchAll(/([MLHV])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
    if (op !== 'V') x = Number(first);
    if (op !== 'H') y = Number(op === 'V' ? first : second);
    vertices.push([x, y]);
  }
  return vertices;
}

test('Office guide formulas agree with the rectangle, rounded rectangle and ellipse', () => {
  const rnd = random(376);
  for (let i = 0; i < 1500; i++) {
    const body = {x: 30, y: 20, w: rnd(80, 380), h: rnd(40, 200)};
    const {w, h} = body;
    const [cx, cy] = center(body);
    let tip: Pt;
    do {
      tip = [cx + rnd(-1.5, 1.5) * w, cy + rnd(-1.5, 1.5) * h];
    } while (Math.abs(tip[0] - cx) < w / 2 + 3 && Math.abs(tip[1] - cy) < h / 2 + 3);
    const adj = officeAdj(body, tip);
    const rounded: Pt = [cx + w * adj[0] / 100000, cy + h * adj[1] / 100000];
    nearPoint(rounded, tip, 0.0022);
    const expected = officeWedges(body, adj);
    const actual = balloonOutline('rect', body, rounded, {base: 'office'});
    const actualRect = essentialVertices(rectangularVertices(actual.d));
    const expectedRect = essentialVertices(expected.rect);
    assert.equal(actualRect.length, 7);
    const first = actualRect.findIndex(p => distance(p, expectedRect[0]!) <= 0.1);
    assert.ok(first >= 0);
    assert.equal(expectedRect.length, actualRect.length);
    expectedRect.forEach((p, index) => nearPoint(actualRect[(first + index) % actualRect.length]!, p, 0.1));

    const radius = Math.min(w, h) * 16667 / 100000;
    const round = balloonOutline('round', body, rounded, {base: 'office', radius});
    const actualRadius = Number(/A([^ ]+)/.exec(round.d)?.[1]);
    near(actualRadius, expected.radius, 0.000003);
    const pivot = expected.round.findIndex(p => distance(p, expected.tip) < 1e-9);
    assert.ok(pivot > 0 && pivot < expected.round.length - 1);
    const wedge = [...round.d.matchAll(/L(-?[\d.]+) (-?[\d.]+)/g)];
    assert.equal(wedge.length, 3);
    wedge.forEach(([, x, y], index) => nearPoint([Number(x), Number(y)], expected.round[pivot - 1 + index]!, 0.1));

    const ellipse = balloonOutline('ellipse', body, rounded, {base: 'office'});
    assert.ok(ellipse.base && ellipse.tip);
    nearPoint(ellipse.tip, expected.tip, 1e-6);
    ellipse.base.forEach((p, index) => nearPoint(p, expected.ellipseBase[index]!, 1e-6));
  }
});

test('Office default adjustments and the fixed follow wedge', () => {
  const body = {x: 0, y: 0, w: 200, h: 80};
  const tip: Pt = [58.334, 90];
  assert.deepEqual(officeAdj(body, tip), [-20833, 62500]);
  for (const shape of ['rect', 'round'] as const) {
    const outline = balloonOutline(shape, body, tip, {base: 'office', radius: 80 * 16667 / 100000});
    assert.equal(outline.side, 'bottom');
    assert.deepEqual(outline.base, [[83.3, 80], [33.3, 80]]);
  }
  const ellipse = balloonOutline('ellipse', body, tip);
  nearPoint(ellipse.base![0], [50.857, 74.837], 0.001);
  nearPoint(ellipse.base![1], [87.060, 79.664], 0.001);
  assert.deepEqual(balloonOutline('round', body, tip, {radius: 8}).base, [[72.3, 80], [44.3, 80]]);
});

const cloudSizes = [48, 72, 96, 120].flatMap(h =>
  [100, 150, 200, 250, 300, 400, 500, 600].filter(w => w >= h && w <= 6 * h).map(w => ({x: -10, y: 20, w, h})),
);

function distanceToPolygon([x, y]: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (const [i, [ax, ay]] of poly.entries()) {
    const [bx, by] = poly[(i + 1) % poly.length]!;
    const dx = bx - ax, dy = by - ay;
    const along = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, (x - (ax + dx * along)) ** 2 + (y - (ay + dy * along)) ** 2);
  }
  return Math.sqrt(best);
}

function insidePolygon([x, y]: Pt, poly: Pt[]): boolean {
  let crossings = 0;
  for (const [i, [ax, ay]] of poly.entries()) {
    const [bx, by] = poly[(i + 1) % poly.length]!;
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) crossings++;
  }
  return crossings % 2 === 1;
}

test('cloud trail clears the outline and its circles at 360 directions on 24 bodies', () => {
  assert.equal(cloudSizes.length, 24);
  for (const body of cloudSizes) {
    const {x, w, h} = body, [cx, cy] = center(body);
    const poly = cloudPolygon(body);
    assert.ok(poly.every(p => p.every(Number.isFinite)));
    assert.ok(balloonOutline('cloud', body, [cx, cy]).inside);
    assert.ok(!balloonOutline('cloud', body, [x - 3, cy]).inside);
    assert.ok(!balloonOutline('cloud', body, [x + w + 3, cy]).inside);
    const ss = Math.min(w, h);
    const radii = cloudRadii(ss);
    assert.deepEqual(radii, [ss / 12, ss / 18, ss / 36]);
    const [r1, r2, r3] = radii;
    for (let deg = 0; deg < 360; deg++) {
      const angle = deg * Math.PI / 180, ux = Math.cos(angle), uy = Math.sin(angle), reach = w / 2 + 60;
      const tip: Pt = [cx + ux * reach, cy + uy * reach];
      const outline = balloonOutline('cloud', body, tip);
      const context = `${w}x${h} at ${deg}°`;
      finite(outline);
      assert.equal(outline.inside, false, context);
      assert.ok(outline.base && outline.dots && outline.minLength !== undefined, context);
      const first = outline.dots[0]!;
      assert.ok(!insidePolygon(first.c, poly) && distanceToPolygon(first.c, poly) - first.r >= 1.9, context);
      assert.ok(outline.minLength >= 2 * r1 + 2 * r2 + r3 + 6 - 1e-9, context);
      const [ex, ey] = outline.base[0];
      const minTip: Pt = [ex + ux * outline.minLength, ey + uy * outline.minLength];
      const shortest = balloonOutline('cloud', body, minTip);
      const [a, b, c] = shortest.dots!;
      assert.ok(distance(a!.c, b!.c) - a!.r - b!.r >= 1.9, context);
      assert.ok(distance(b!.c, c!.c) - b!.r - c!.r >= 1.9, context);
    }
  }
});

test('cloud regression and fixed trail geometry', () => {
  const regression = balloonOutline('cloud', {x: 0, y: 0, w: 300, h: 120}, [-111, 13]);
  assert.equal(regression.inside, false);
  assert.ok(regression.dots);
  finite(regression);
  const outline = balloonOutline('cloud', {x: 0, y: 0, w: 200, h: 80}, [100, 160]);
  assert.equal(outline.dots?.length, 3);
  const ys = [86.21, 123.1, 160], radii = [6.67, 4.44, 2.22];
  outline.dots!.forEach((dot, i) => {
    nearPoint(dot.c, [100, ys[i]!], 0.05);
    near(dot.r, radii[i]!, 0.005);
  });
  near(outline.minLength!, 30.44, 0.05);
});

test('cloudTextRect is centred, proportional and maximal against the sampled arcs', () => {
  for (const body of cloudSizes) {
    const poly = cloudPolygon(body);
    const rect = cloudTextRect(body);
    assert.deepEqual(rect, cloudTextRect(body));
    near(rect.w / rect.h, body.w / body.h, 1e-12);
    const [cx, cy] = center(body);
    nearPoint(center(rect), [cx, cy], 1e-12);
    assert.ok(rect.w / body.w >= 0.45 && rect.w / body.w <= 0.72);
    const offsets: Pt[] = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]];
    const fits = (scale: number) => offsets.every(([u, v]) =>
      insidePolygon([cx + u * rect.w / 2 * scale, cy + v * rect.h / 2 * scale], poly));
    assert.equal(fits(1), true);
    assert.equal(fits(1.03), false);
  }
});

test('cloudTextRect can use a wider interval after a corner re-enters the cloud', () => {
  const body = {x: -10, y: 20, w: 200, h: 48};
  // At this aspect ratio the first interval ends at 49%; the outer one ends at 63%.
  near(cloudTextRect(body).w / body.w, 0.628, 0.001);
});
