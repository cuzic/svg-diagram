// badge: the label sits at the centre of its shape. The shape was snapped to the 4px grid and the text only rounded to the pixel,
// so the two disagreed by up to 2px (cx 14: circle at 16, text at 14).
import test from 'node:test';
import assert from 'node:assert/strict';
import {badgeSvg} from '../lib/badge.ts';

const snap4 = (n: number): number => Math.round(n / 4) * 4;
const esc = (s: string): string => s;
const num = (s: string, re: RegExp): number => Number(must(re.exec(s))[1]);
const must = <T>(x: T | null | undefined): T => { assert.ok(x != null); return x; };

/** Centre of the drawn shape, read from the SVG. */
function shapeCentre(svg: string): {x: number; y: number} {
  const c = /<circle cx="([\d.-]+)" cy="([\d.-]+)"/.exec(svg);
  if (c) return {x: Number(c[1]), y: Number(c[2])};
  const r = /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/.exec(svg);
  if (r) return {x: Number(r[1]) + Number(r[3]) / 2, y: Number(r[2]) + Number(r[4]) / 2};
  throw new Error('no shape');
}

for (const shape of ['circle', 'square'] as const) {
  for (const cx of [13, 14, 15, 17, 18, 19, 21, 22]) {
    test(`${shape} badge at cx ${cx}: the text is on the shape's centre line`, () => {
      const svg = badgeSvg({cx, cy: 40, shape, r: 11, w: 22, label: '1', aria: '1', size: 14, fill: '#3366cc', snap: snap4, esc});
      const tx = num(svg, /<text x="([\d.-]+)"/);
      assert.equal(tx, shapeCentre(svg).x, `text x ${tx} vs shape centre ${shapeCentre(svg).x}`);
    });
  }
}
