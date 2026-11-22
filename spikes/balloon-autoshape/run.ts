// node spikes/balloon-autoshape/run.ts [outdir]  — writes the SVG sheets and prints the measurements quoted in ADR 0077.
import fs from 'node:fs';
import {balloonOutline, cloudMinLength, cloudPolygon, distToPolygon, officeAdj, triangleHitsRect, type BalloonShape, type Pt, type Rect} from './balloon.ts';
import {officeWedgeRect} from './office.ts';
import {balloonPath} from './pr436-balloon-path.ts';

const out = process.argv[2] ?? new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(out, {recursive: true});
const BODY: Rect = {x: 140, y: 120, w: 200, h: 80};
const SHAPES: BalloonShape[] = ['rect', 'round', 'ellipse', 'cloud'];
const cx = BODY.x + BODY.w / 2, cy = BODY.y + BODY.h / 2;
const lines: string[] = [];
const rep = (s: string) => { lines.push(s); console.log(s); };

function target(shape: BalloonShape, deg: number, gap: number): Pt {
  const u: Pt = [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
  const edge = shape === 'ellipse' || shape === 'cloud' ? 1 / Math.hypot(u[0] / (BODY.w / 2), u[1] / (BODY.h / 2)) : Math.min(BODY.w / 2 / Math.abs(u[0] || 1e-9), BODY.h / 2 / Math.abs(u[1] || 1e-9));
  return [cx + u[0] * (edge + gap), cy + u[1] * (edge + gap)];
}
const distRect = (p: Pt, r: Rect): number => { const qx = Math.abs(p[0] - (r.x + r.w / 2)) - r.w / 2, qy = Math.abs(p[1] - (r.y + r.h / 2)) - r.h / 2; return Math.abs(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)); };
const distEllipse = (p: Pt, r: Rect): number => {
  const a = r.w / 2, c = r.h / 2; let best = 1e9, bu = 0;
  for (let i = 0; i < 3600; i++) { const u = i / 3600 * 2 * Math.PI, d = Math.hypot(r.x + a + a * Math.cos(u) - p[0], r.y + c + c * Math.sin(u) - p[1]); if (d < best) { best = d; bu = u; } }
  for (let s = 1e-3; s > 1e-9; s /= 2) for (const du of [-s, s]) { const u = bu + du, d = Math.hypot(r.x + a + a * Math.cos(u) - p[0], r.y + c + c * Math.sin(u) - p[1]); if (d < best) { best = d; bu = u; } }
  return best;
};
const svgHead = (w: number, h: number): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="sans-serif" font-size="16"><rect width="100%" height="100%" fill="#fff"/>`;
const draw = (shape: BalloonShape, tip: Pt, ox: number, oy: number, base: 'follow' | 'office' = 'follow', label = 'ここが変更点'): string => {
  const bl = balloonOutline(shape, BODY, tip, {base});
  const dots = (bl.dots ?? []).map(q => `<circle cx="${q.c[0]}" cy="${q.c[1]}" r="${q.r}" fill="#fff8e1" stroke="#333" stroke-width="2"/>`).join('');
  return `<g transform="translate(${ox} ${oy})"><path d="${bl.d}" fill="#fff8e1" stroke="#333" stroke-width="2" stroke-linejoin="round"/>${dots}<text x="${cx}" y="${cy + 5}" text-anchor="middle">${label}</text><circle cx="${tip[0]}" cy="${tip[1]}" r="2.5" fill="#c00"/></g>`;
};

// 1. 8 directions x 4 shapes
const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];
let maxBaseOff = 0, minClear = 1e9, closedAll = true, detAll = true, n = 0;
for (const shape of SHAPES) {
  let svg = svgHead(1520, 700);
  DIRS.forEach((deg, i) => {
    const tip = target(shape, deg, 50);
    svg += draw(shape, tip, (i % 4) * 380 - 100, Math.floor(i / 4) * 300 - 60);
    const bl = balloonOutline(shape, BODY, tip), bl2 = balloonOutline(shape, BODY, tip);
    n++; detAll &&= bl.d === bl2.d; closedAll &&= bl.d.startsWith('M') && bl.d.endsWith('Z');
    if (shape === 'rect' || shape === 'round') {
      const r = shape === 'round' ? 8 : 0;
      for (const p of bl.base!) { maxBaseOff = Math.max(maxBaseOff, distRect(p, BODY)); minClear = Math.min(minClear, Math.min(...[[BODY.x, BODY.y], [BODY.x + BODY.w, BODY.y], [BODY.x, BODY.y + BODY.h], [BODY.x + BODY.w, BODY.y + BODY.h]].map(c => Math.hypot(p[0] - c[0], p[1] - c[1]))) - r); }
    } else if (shape === 'ellipse') for (const p of bl.base!) maxBaseOff = Math.max(maxBaseOff, distEllipse(p, BODY));
  });
  fs.writeFileSync(`${out}/${shape}-8dir.svg`, svg + '</svg>');
}
rep(`8 directions x 4 shapes: ${n} balloons; deterministic=${detAll}; every path closed=${closedAll}`);
rep(`regression (checks the code against itself): max distance of a rect / round / ellipse base point from the outline = ${maxBaseOff.toExponential(1)} px (one-decimal rounding for rect / round: <= 0.07); min distance of a rect / round base point from a corner, minus the radius = ${minClear.toFixed(1)} px`);

// 2. cloud against the REAL outline (not the envelope)
{
  const poly = cloudPolygon(BODY);
  let overlap = 0, minGap = 1e9, maxGap = -1e9, minRun = 1e9, maxMin = 0, minMin = 1e9;
  for (let deg = 0; deg < 360; deg++) {
    const tip = target('cloud', deg, 60), bl = balloonOutline('cloud', BODY, tip), d1 = bl.dots![0]!, d2 = bl.dots![1]!, d3 = bl.dots![2]!;
    const g = distToPolygon(d1.c, poly) - d1.r;
    if (g < 0) overlap++;
    maxMin = Math.max(maxMin, bl.minLength!); minMin = Math.min(minMin, bl.minLength!);
    minGap = Math.min(minGap, g); maxGap = Math.max(maxGap, g);
    const gap = (p: typeof d1, q: typeof d1) => Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) - p.r - q.r;
    minRun = Math.min(minRun, gap(d1, d2), gap(d2, d3));
  }
  rep(`cloud, trail started from the real outline, 360 directions: first circle overlaps the outline in ${overlap}/360; gap min ${minGap.toFixed(2)}, max ${maxGap.toFixed(2)} px; smallest gap between circles ${minRun.toFixed(2)} px`);
  rep(`cloud minimum tail length over the 360 directions (ss = 80): ${minMin.toFixed(1)}..${maxMin.toFixed(1)} px (the closed form 0.306 ss + 6 = ${cloudMinLength(80).toFixed(1)} is the lower end; the first circle moves out where a bump is in the way)`);
  const tries = [[0, 12], [0, 20], [0, 28], [0, 31], [0, 36]];
  rep(`cloud minimum tail length for ss = 80: ${cloudMinLength(80).toFixed(1)} px (= 0.306 ss + 6; Office's own limit g9 = ${(80 * 6600 / 21600).toFixed(1)} px). Trail circle gaps (direction 0) by length:`);
  for (const [deg, gap] of tries) { const bl = balloonOutline('cloud', BODY, target('cloud', deg, gap)), g = (p: {c: Pt; r: number}, q: {c: Pt; r: number}) => Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) - p.r - q.r; rep(`  length ${bl.length.toFixed(1)}: gap(1,2) ${g(bl.dots![0]!, bl.dots![1]!).toFixed(1)}, gap(2,3) ${g(bl.dots![1]!, bl.dots![2]!).toFixed(1)}`); }
  rep(`cloud circles at the smallest body (72x48, ss 48): radii ${[48 / 12, 48 / 18, 48 / 36].map(v => v.toFixed(1)).join(' / ')} px`);
}

// 3. close targets: length and apex angle
rep('| shape | gap (px) | tail length | apex angle | inside |');
for (const shape of SHAPES) {
  let svg = svgHead(1520, 330);
  [-20, 0, 2, 4, 8, 16].forEach((gap, i) => {
    const tip = target(shape, 0, gap), bl = balloonOutline(shape, BODY, tip);
    svg += draw(shape, tip, (i % 3) * 500 - 100, Math.floor(i / 3) * 150 - 50);
    rep(`| ${shape} | ${gap} | ${bl.length.toFixed(1)} | ${bl.apex.toFixed(0)} | ${bl.inside} |`);
  });
  fs.writeFileSync(`${out}/${shape}-near.svg`, svg + '</svg>');
}
{ // apex angle vs length for the two base widths (comic 16, a 200x80 balloon's top side 28)
  const apex = (bw: number, len: number) => (2 * Math.atan2(bw / 2, len) * 180 / Math.PI).toFixed(0);
  rep(`apex angle by tail length, base width 16 / 28: len 4 -> ${apex(16, 4)} / ${apex(28, 4)}, 8 -> ${apex(16, 8)} / ${apex(28, 8)}, 14 -> ${apex(16, 14)} / ${apex(28, 14)}, 30 -> ${apex(16, 30)} / ${apex(28, 30)}, 80 -> ${apex(16, 80)} / ${apex(28, 80)}, 160 -> ${apex(16, 160)} / ${apex(28, 160)}, 300 -> ${apex(16, 300)} / ${apex(28, 300)}`);
}

// 4. the tail's triangle against the old axis-aligned rectangle (segRect: the tip-to-base segment's bounding box + 3 px)
{
  const rows: string[] = [];
  for (const deg of DIRS) {
    const bl = balloonOutline('round', BODY, target('round', deg, 50)), tri: [Pt, Pt, Pt] = [bl.base![0], bl.tip!, bl.base![1]];
    const xs = tri.map(p => p[0]), ys = tri.map(p => p[1]), box: Rect = {x: Math.min(...xs) - 3, y: Math.min(...ys) - 3, w: Math.max(...xs) - Math.min(...xs) + 6, h: Math.max(...ys) - Math.min(...ys) + 6};
    let inTri = 0, tot = 0;
    for (let i = 0; i < 100; i++) for (let j = 0; j < 100; j++) { const p: Pt = [box.x + (i + 0.5) / 100 * box.w, box.y + (j + 0.5) / 100 * box.h]; tot++; if (triangleHitsRect(tri, {x: p[0] - 0.5, y: p[1] - 0.5, w: 1, h: 1}, 0)) inTri++; }
    rows.push(`${deg}deg: ${(100 * inTri / tot).toFixed(0)}%`);
  }
  rep(`share of the tail's bounding box that the triangle really covers (round, 8 directions, tip 50 px out): ${rows.join(', ')}`);
  // a neighbour box that touches only the bounding box of a 45 degree tail
  const bl = balloonOutline('round', BODY, target('round', 45, 50)), tri: [Pt, Pt, Pt] = [bl.base![0], bl.tip!, bl.base![1]];
  void tri;
  const sk = balloonOutline('round', BODY, [BODY.x + BODY.w + 40, BODY.y + BODY.h + 60]), st: [Pt, Pt, Pt] = [sk.base![0], sk.tip!, sk.base![1]];
  const sx = st.map(p => p[0]), sy = st.map(p => p[1]), sbox: Rect = {x: Math.min(...sx) - 3, y: Math.min(...sy) - 3, w: Math.max(...sx) - Math.min(...sx) + 6, h: Math.max(...sy) - Math.min(...sy) + 6};
  let cov = 0; for (let i = 0; i < 100; i++) for (let j = 0; j < 100; j++) if (triangleHitsRect(st, {x: sbox.x + (i + 0.5) / 100 * sbox.w - 0.5, y: sbox.y + (j + 0.5) / 100 * sbox.h - 0.5, w: 1, h: 1}, 0)) cov++;
  const nb: Rect = {x: 301, y: 240, w: 30, h: 20};
  rep(`a skewed tail (tip 40 px right of the body's right edge and 60 below it): the triangle covers ${(cov / 100).toFixed(0)}% of its bounding box; a 30x20 neighbour inside the bounding box but off the triangle: AABB overlap=${nb.x < sbox.x + sbox.w && nb.x + nb.w > sbox.x && nb.y < sbox.y + sbox.h && nb.y + nb.h > sbox.y}, SAT hit=${triangleHitsRect(st, nb)}`);
}

// 5. the corner and the base modes
{
  let svg = svgHead(760, 320);
  [[BODY.x + BODY.w + 30, BODY.y - 30], [BODY.x + BODY.w - 4, BODY.y - 30], [BODY.x + BODY.w + 30, BODY.y + 4], [BODY.x + BODY.w + 60, BODY.y - 8]].forEach((t, i) => {
    svg += draw('round', t as Pt, (i % 2) * 380 - 100, Math.floor(i / 2) * 150 - 50);
    const bl = balloonOutline('round', BODY, t as Pt);
    rep(`corner target ${i + 1}: side=${bl.side} base x=${bl.base!.map(p => p[0].toFixed(1)).join('..')} y=${bl.base!.map(p => p[1].toFixed(1)).join('..')}`);
  });
  fs.writeFileSync(`${out}/round-corner.svg`, svg + '</svg>');
  // a tip in the corner cutout of a round body: outside the outline although inside the bounding rectangle
  const cut: Pt = [BODY.x + BODY.w - 1.5, BODY.y + 1.5];
  rep(`tip in the corner cutout (round r=8, 1.5 px in from both edges): inside=${balloonOutline('round', BODY, cut).inside}, as a rect: ${balloonOutline('rect', BODY, cut).inside}`);
}

// 6. the shared generator against PR #436's balloonPath (say: radius min(h/2,24), wedge half 8)
{
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let same = 0, total = 0, tieDiff = 0;
  for (let i = 0; i < 3000; i++) {
    const w = 120 + rnd() * 200, h = 48 + rnd() * 80, b: Rect = {x: 20, y: 30, w, h};
    const tip: Pt = [b.x + w / 2 + (rnd() - 0.5) * w * 3, b.y + h / 2 + (rnd() - 0.5) * h * 4];
    if (Math.abs(tip[0] - (b.x + w / 2)) < w / 2 + 3 && Math.abs(tip[1] - (b.y + h / 2)) < h / 2 + 3) continue;
    const mine = balloonOutline('round', b, tip, {radius: Math.min(h / 2, 24), halfWidth: 8}), theirs = balloonPath(b, 'say', {tip});
    total++; if (mine.d === theirs.d) same++;
  }
  for (const b of [{x: 20, y: 30, w: 200, h: 100}, {x: 20, y: 30, w: 240, h: 60}]) { // exact ties: the tip on a diagonal of the body
    const tip: Pt = [b.x + b.w / 2 + b.w, b.y + b.h / 2 + b.h];
    const mine = balloonOutline('round', b, tip, {radius: Math.min(b.h / 2, 24), halfWidth: 8}), theirs = balloonPath(b, 'say', {tip});
    if (mine.d !== theirs.d) tieDiff++;
  }
  rep(`balloonOutline('round', {radius: min(h/2,24), halfWidth: 8}) vs PR #436 balloonPath('say'): ${same}/${total} random tips give the identical path text; 2 exact diagonal ties: ${tieDiff} differ (the tie leaves through a left / right side here, through top / bottom in #436)`);
}

// 7. Office oracles: wedgeRectCallout literal evaluation vs office mode (rect), 2000 random tips
{
  const simplify = (pts: Pt[]): Pt[] => {
    const o: Pt[] = [];
    for (const p of pts) if (!o.length || Math.hypot(p[0] - o[o.length - 1]![0], p[1] - o[o.length - 1]![1]) > 1e-6) o.push(p);
    if (Math.hypot(o[0]![0] - o.at(-1)![0], o[0]![1] - o.at(-1)![1]) < 1e-6) o.pop();
    return o.filter((p, i) => { const a = o[(i + o.length - 1) % o.length]!, c = o[(i + 1) % o.length]!; return Math.abs((p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0])) > 1e-3; });
  };
  const parse = (d: string): Pt[] => [...d.matchAll(/[MLHV]([-\d.]+)(?: ([-\d.]+))?/g)].map(m => [Number(m[1]), Number(m[2])] as Pt).filter(p => !Number.isNaN(p[1]));
  let same = 0, total = 0, maxAdjErr = 0;
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 2000; i++) {
    const w = 80 + rnd() * 300, h = 40 + rnd() * 160, r: Rect = {x: 30, y: 20, w, h};
    const tip: Pt = [r.x + w / 2 + (rnd() - 0.5) * w * 3, r.y + h / 2 + (rnd() - 0.5) * h * 3];
    if (Math.abs(tip[0] - (r.x + w / 2)) < w / 2 + 3 && Math.abs(tip[1] - (r.y + h / 2)) < h / 2 + 3) continue;
    const [a1, a2] = officeAdj(r, tip), tr: Pt = [r.x + w / 2 + w * a1 / 100000, r.y + h / 2 + h * a2 / 100000];
    maxAdjErr = Math.max(maxAdjErr, Math.hypot(tr[0] - tip[0], tr[1] - tip[1]));
    // the generator's path text uses H / V; read the wedge's three points (base0, tip, base1) back from it
    const bl = balloonOutline('rect', r, tr, {base: 'office'}), theirs = simplify(officeWedgeRect(w, h, a1, a2).map(p => [p[0] + r.x, p[1] + r.y] as Pt));
    const mine = simplify([[r.x, r.y], ...[bl.base![0], bl.tip!, bl.base![1]], [r.x + w, r.y], [r.x + w, r.y + h], [r.x, r.y + h]].map(p => p as Pt));
    // compare as vertex SETS: the wedge's three points plus the four corners
    const all = new Set(theirs.map(p => `${p[0].toFixed(0)}`)); void all;
    total++;
    const corners: Pt[] = [[r.x, r.y], [r.x + w, r.y], [r.x + w, r.y + h], [r.x, r.y + h]];
    const need = [...corners, bl.base![0], bl.tip!, bl.base![1]];
    if (need.every(p => theirs.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.1)) && theirs.length === need.length) same++;
    void mine; void parse;
  }
  rep(`Office wedgeRectCallout (ECMA-376 gdLst, literal) vs balloonOutline('rect', base 'office'): ${same}/${total} random tips (outside the body by >= 3 px) give the same polygon (4 corners + base, tip, base; 0.1 px). adj rounding moves a tip by at most ${maxAdjErr.toExponential(1)} px. Covered: rect + office only`);
  const r: Rect = {x: 0, y: 0, w: 200, h: 80};
  rep(`default adj1=-20833 adj2=62500 on 200x80 -> tip (${(100 - 41.666).toFixed(1)}, 90.0); officeAdj of that tip = ${officeAdj(r, [100 - 41.666, 90])}`);
  let svg = svgHead(800, 300);
  const tip: Pt = [BODY.x + BODY.w + 40, BODY.y + 130];
  svg += draw('rect', tip, -100, -50, 'follow', 'follow') + draw('rect', tip, 300, -50, 'office', 'office');
  fs.writeFileSync(`${out}/rect-follow-vs-office.svg`, svg + '</svg>');
}
fs.writeFileSync(`${out}/measurements.txt`, lines.join('\n') + '\n');
