// node spikes/balloon-autoshape/run.ts [outdir]  — writes the SVG sheets and prints the measurements quoted in ADR 0077.
import fs from 'node:fs';
import {balloon, cloudEnvelope, officeAdj, type BalloonShape, type Pt, type Rect} from './balloon.ts';
import {officeWedgeRect} from './office.ts';

const out = process.argv[2] ?? new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(out, {recursive: true});
const BODY: Rect = {x: 140, y: 120, w: 200, h: 80};
const SHAPES: BalloonShape[] = ['rect', 'round', 'ellipse', 'cloud'];
const cx = BODY.x + BODY.w / 2, cy = BODY.y + BODY.h / 2;

// the point `gap` outside the body's own outline in direction k*45deg (the outline of the shape's box; ellipse and cloud use the ellipse)
function target(shape: BalloonShape, deg: number, gap: number): Pt {
  const u: Pt = [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
  const edge = shape === 'ellipse' || shape === 'cloud' ? 1 / Math.hypot(u[0] / (BODY.w / 2), u[1] / (BODY.h / 2)) : Math.min(BODY.w / 2 / Math.abs(u[0] || 1e-9), BODY.h / 2 / Math.abs(u[1] || 1e-9));
  return [cx + u[0] * (edge + gap), cy + u[1] * (edge + gap)];
}
// distance of p from the outline of the shape's box
function distRect(p: Pt, r: Rect): number {
  const qx = Math.abs(p[0] - (r.x + r.w / 2)) - r.w / 2, qy = Math.abs(p[1] - (r.y + r.h / 2)) - r.h / 2;
  return Math.abs(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0));
}
const distEllipse = (p: Pt, r: Rect): number => { // by sampling the parameter, then refining: the true distance to the ellipse
  const a = r.w / 2, c = r.h / 2; let best = 1e9, bu = 0;
  for (let i = 0; i < 3600; i++) { const u = i / 3600 * 2 * Math.PI, d = Math.hypot(r.x + a + a * Math.cos(u) - p[0], r.y + c + c * Math.sin(u) - p[1]); if (d < best) { best = d; bu = u; } }
  for (let s = 1e-3; s > 1e-9; s /= 2) for (const du of [-s, s]) { const u = bu + du, d = Math.hypot(r.x + a + a * Math.cos(u) - p[0], r.y + c + c * Math.sin(u) - p[1]); if (d < best) { best = d; bu = u; } }
  return best;
};

const svgHead = (w: number, h: number): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="sans-serif" font-size="16"><rect width="100%" height="100%" fill="#fff"/>`;
const draw = (shape: BalloonShape, tip: Pt, ox: number, oy: number, mode: 'follow' | 'office' = 'follow', label = 'ここが変更点'): string => {
  const bl = balloon(shape, BODY, tip, {baseMode: mode});
  const fill = '#fff8e1', stroke = '#333';
  return `<g transform="translate(${ox} ${oy})"><path d="${bl.d}" fill="${fill}" stroke="${stroke}" stroke-width="2" fill-rule="nonzero"/><text x="${cx}" y="${cy + 5}" text-anchor="middle">${label}</text><circle cx="${tip[0]}" cy="${tip[1]}" r="2.5" fill="#c00"/>${bl.base[0] === bl.base[1] ? '' : bl.base.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2" fill="#06c"/>`).join('')}</g>`;
};

const lines: string[] = [];
const rep = (s: string) => { lines.push(s); console.log(s); };
const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];
let maxBaseOff = 0, minClear = 1e9, closedAll = true, detAll = true, n = 0;

for (const shape of SHAPES) {
  let svg = svgHead(1520, 700);
  DIRS.forEach((deg, i) => {
    const tip = target(shape, deg, 50), ox = (i % 4) * 380 - 100, oy = Math.floor(i / 4) * 300 - 60;
    svg += draw(shape, tip, ox, oy);
    const bl = balloon(shape, BODY, tip), bl2 = balloon(shape, BODY, tip);
    n++; detAll &&= bl.d === bl2.d; closedAll &&= bl.d.startsWith('M') && bl.d.endsWith('Z');
    if (shape === 'rect' || shape === 'round') {
      for (const p of bl.base) maxBaseOff = Math.max(maxBaseOff, distRect(p, BODY));
      // clearance of the base from the nearest corner along the side
      const r = shape === 'round' ? Math.min(BODY.w, BODY.h) / 6 : 0;
      for (const p of bl.base) minClear = Math.min(minClear, Math.min(...[[BODY.x, BODY.y], [BODY.x + BODY.w, BODY.y], [BODY.x, BODY.y + BODY.h], [BODY.x + BODY.w, BODY.y + BODY.h]].map(c => Math.hypot(p[0] - c[0], p[1] - c[1]))) - r);
    } else if (shape === 'ellipse') for (const p of bl.base) maxBaseOff = Math.max(maxBaseOff, distEllipse(p, BODY));
  });
  fs.writeFileSync(`${out}/${shape}-8dir.svg`, svg + '</svg>');
}
rep(`8 directions x 4 shapes: ${n} balloons; deterministic=${detAll}; every path closed=${closedAll}`);
rep(`rect/round/ellipse: max distance of a base point from the outline = ${maxBaseOff.toExponential(2)} px; min distance of a rect/round base point from a corner (minus the corner radius) = ${minClear.toFixed(1)} px`);

// cloud: how far the first circle of the trail is from the outline
{
  const gaps = DIRS.map(deg => { const bl = balloon('cloud', BODY, target('cloud', deg, 50)), d = bl.dots![0]!; return distEllipse(d.c, cloudEnvelope(BODY)) - d.r; });
  rep(`cloud: gap between the outline envelope and the first trail circle, 8 directions: min ${Math.min(...gaps).toFixed(1)}, max ${Math.max(...gaps).toFixed(1)} px`);
}

// a target close to the body: tail length and what happens
rep('| shape | gap to the outline (px) | tail length (px) | inside | note |');
for (const shape of SHAPES) {
  let svg = svgHead(1520, 330);
  [-20, 0, 2, 4, 8, 16].forEach((gap, i) => {
    const tip = target(shape, 0, gap), bl = balloon(shape, BODY, tip);
    svg += draw(shape, tip, (i % 3) * 500 - 100, Math.floor(i / 3) * 150 - 50);
    rep(`| ${shape} | ${gap} | ${bl.length.toFixed(1)} | ${bl.inside} | ${bl.length < 6 ? 'tail shorter than 6px: too short' : ''} |`);
  });
  fs.writeFileSync(`${out}/${shape}-near.svg`, svg.replace('height="330"', 'height="330"') + '</svg>');
}

// near a corner: the side the tail takes and the clamp
{
  let svg = svgHead(760, 320);
  [[BODY.x + BODY.w + 30, BODY.y - 30], [BODY.x + BODY.w - 4, BODY.y - 30], [BODY.x + BODY.w + 30, BODY.y + 4], [BODY.x + BODY.w + 60, BODY.y - 8]].forEach((t, i) => {
    svg += draw('round', t as Pt, (i % 2) * 380 - 100, Math.floor(i / 2) * 150 - 50);
    const bl = balloon('round', BODY, t as Pt);
    rep(`corner target ${i + 1}: side=${bl.side} base x=${bl.base.map(p => p[0].toFixed(1)).join('..')} y=${bl.base.map(p => p[1].toFixed(1)).join('..')}`);
  });
  fs.writeFileSync(`${out}/round-corner.svg`, svg + '</svg>');
}

// Office comparison (wedgeRectCallout): the literal gdLst evaluation against balloon('rect', baseMode 'office')
{
  const simplify = (pts: Pt[]): Pt[] => {
    const o: Pt[] = [];
    for (const p of pts) if (!o.length || Math.hypot(p[0] - o[o.length - 1]![0], p[1] - o[o.length - 1]![1]) > 1e-6) o.push(p);
    if (Math.hypot(o[0]![0] - o.at(-1)![0], o[0]![1] - o.at(-1)![1]) < 1e-6) o.pop();
    const k = o.filter((p, i) => { const a = o[(i + o.length - 1) % o.length]!, c = o[(i + 1) % o.length]!; return Math.abs((p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0])) > 1e-6; });
    return k;
  };
  const parse = (d: string): Pt[] => [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as Pt);
  let same = 0, total = 0, maxAdjErr = 0;
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 2000; i++) {
    const w = 80 + rnd() * 300, h = 40 + rnd() * 160, r: Rect = {x: 30, y: 20, w, h};
    const tip: Pt = [r.x + w / 2 + (rnd() - 0.5) * w * 3, r.y + h / 2 + (rnd() - 0.5) * h * 3];
    if (Math.abs(tip[0] - (r.x + w / 2)) < w / 2 + 3 && Math.abs(tip[1] - (r.y + h / 2)) < h / 2 + 3) continue;
    const [a1, a2] = officeAdj(r, tip); // the rounding to 1/100000 is the Office file's resolution
    const tipRounded: Pt = [r.x + w / 2 + w * a1 / 100000, r.y + h / 2 + h * a2 / 100000];
    maxAdjErr = Math.max(maxAdjErr, Math.hypot(tipRounded[0] - tip[0], tipRounded[1] - tip[1]));
    const mine = simplify(parse(balloon('rect', r, tipRounded, {baseMode: 'office'}).d)), theirs = simplify(officeWedgeRect(w, h, a1, a2).map(p => [p[0] + r.x, p[1] + r.y] as Pt));
    total++; if (mine.length === theirs.length && mine.every(p => theirs.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.02))) same++;
  }
  rep(`Office wedgeRectCallout (ECMA-376 gdLst, literal) vs balloon('rect', office mode): ${same}/${total} random tips give the same polygon (same vertex set within 0.02 px, the path text is rounded to 0.01); adj rounding moves a tip by at most ${maxAdjErr.toExponential(1)} px`);
  // the default adj of the preset
  const r: Rect = {x: 0, y: 0, w: 200, h: 80};
  rep(`default adj1=-20833 adj2=62500 on 200x80 -> tip (${(100 - 41.666).toFixed(1)}, ${(40 + 50).toFixed(1)}); officeAdj of that tip = ${officeAdj(r, [100 - 41.666, 90])}`);
  let svg = svgHead(800, 300);
  const tip: Pt = [BODY.x + BODY.w + 40, BODY.y + 130];
  svg += draw('rect', tip, -100, -50, 'follow', 'follow') + draw('rect', tip, 300, -50, 'office', 'office');
  fs.writeFileSync(`${out}/rect-follow-vs-office.svg`, svg + '</svg>');
}
fs.writeFileSync(`${out}/measurements.txt`, lines.join('\n') + '\n');
