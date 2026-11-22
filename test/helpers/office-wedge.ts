// This file transcribes guide formulas from presetShapeDefinitions.xml (ECMA-376 Part 1, 5th edition, 2016).
// (c) Ecma International. The default notice of Ecma's text copyright policy (version 3) applies.
import type {Pt, Rect} from '../../lib/shapes/balloon.ts';

const rectGuides = `
dxPos */ w adj1 100000
dyPos */ h adj2 100000
xPos +- hc dxPos 0
yPos +- vc dyPos 0
dx +- xPos 0 hc
dy +- yPos 0 vc
dq */ dxPos h w
ady abs dyPos
adq abs dq
dz +- ady 0 adq
xg1 ?: dxPos 7 2
xg2 ?: dxPos 10 5
x1 */ w xg1 12
x2 */ w xg2 12
yg1 ?: dyPos 7 2
yg2 ?: dyPos 10 5
y1 */ h yg1 12
y2 */ h yg2 12
t1 ?: dxPos l xPos
xl ?: dz l t1
t2 ?: dyPos x1 xPos
xt ?: dz t2 x1
t3 ?: dxPos xPos r
xr ?: dz r t3
t4 ?: dyPos xPos x1
xb ?: dz t4 x1
t5 ?: dxPos y1 yPos
yl ?: dz y1 t5
t6 ?: dyPos t yPos
yt ?: dz t6 t
t7 ?: dxPos yPos y1
yr ?: dz y1 t7
t8 ?: dyPos yPos b
yb ?: dz t8 b
`.trim();

// wedgeRoundRectCallout uses the same wedge guides, except for the unused dx and dy.
const roundGuides = `
u1 */ ss adj3 100000
u2 +- r 0 u1
v2 +- b 0 u1
il */ u1 29289 100000
ir +- r 0 il
ib +- b 0 il
`.trim();

const ellipseGuides = `
dxPos */ w adj1 100000
dyPos */ h adj2 100000
xPos +- hc dxPos 0
yPos +- vc dyPos 0
sdx */ dxPos h 1
sdy */ dyPos w 1
pang at2 sdx sdy
stAng +- pang 660000 0
enAng +- pang 0 660000
dx1 cos wd2 stAng
dy1 sin hd2 stAng
x1 +- hc dx1 0
y1 +- vc dy1 0
dx2 cos wd2 enAng
dy2 sin hd2 enAng
x2 +- hc dx2 0
y2 +- vc dy2 0
stAng1 at2 dx1 dy1
enAng1 at2 dx2 dy2
swAng1 +- enAng1 0 stAng1
swAng2 +- swAng1 21600000 0
swAng ?: swAng1 swAng1 swAng2
idx cos wd2 2700000
idy sin hd2 2700000
il +- hc 0 idx
ir +- hc idx 0
it +- vc 0 idy
ib +- vc idy 0
`.trim();

const radiansPerAngle = Math.PI / 10800000;

function evaluate(formulas: string, w: number, h: number, [adj1, adj2]: Pt): Map<string, number> {
  const values = new Map(Object.entries({
    w, h, l: 0, t: 0, r: w, b: h, hc: w / 2, vc: h / 2, wd2: w / 2, hd2: h / 2,
    ss: Math.min(w, h), adj1, adj2, adj3: 16667,
  }));
  const read = (arg: string | undefined): number => arg === undefined ? 0 : values.get(arg) ?? Number(arg);
  const ops: Record<string, (a: number, b: number, c: number) => number> = {
    '*/': (a, b, c) => a * b / c,
    '+-': (a, b, c) => a + b - c,
    '?:': (a, b, c) => a > 0 ? b : c,
    abs: Math.abs,
    at2: (x, y) => Math.atan2(y, x) / radiansPerAngle,
    cos: (r, angle) => r * Math.cos(angle * radiansPerAngle),
    sin: (r, angle) => r * Math.sin(angle * radiansPerAngle),
  };
  for (const line of formulas.split('\n')) {
    const [name, op, a, b, c] = line.split(' ');
    values.set(name!, ops[op!]!(read(a), read(b), read(c)));
  }
  return values;
}

type Vertex = [string, string];
const rectPath: Vertex[] = [
  ['l', 't'], ['x1', 't'], ['xt', 'yt'], ['x2', 't'],
  ['r', 't'], ['r', 'y1'], ['xr', 'yr'], ['r', 'y2'],
  ['r', 'b'], ['x2', 'b'], ['xb', 'yb'], ['x1', 'b'],
  ['l', 'b'], ['l', 'y2'], ['xl', 'yl'], ['l', 'y1'],
];
const roundPath: Vertex[] = [
  ['u1', 't'], ['x1', 't'], ['xt', 'yt'], ['x2', 't'], ['u2', 't'],
  ['r', 'u1'], ['r', 'y1'], ['xr', 'yr'], ['r', 'y2'], ['r', 'v2'],
  ['u2', 'b'], ['x2', 'b'], ['xb', 'yb'], ['x1', 'b'], ['u1', 'b'],
  ['l', 'v2'], ['l', 'y2'], ['xl', 'yl'], ['l', 'y1'], ['l', 'u1'],
];

export function officeWedges({x, y, w, h}: Rect, adj: Pt) {
  const rect = evaluate(rectGuides, w, h, adj);
  const round = evaluate(rectGuides + '\n' + roundGuides, w, h, adj);
  const ellipse = evaluate(ellipseGuides, w, h, adj);
  const point = (values: Map<string, number>, [gx, gy]: Vertex): Pt => [x + values.get(gx)!, y + values.get(gy)!];
  return {
    rect: rectPath.map(vertex => point(rect, vertex)),
    round: roundPath.map(vertex => point(round, vertex)),
    radius: round.get('u1')!,
    ellipseBase: [point(ellipse, ['x1', 'y1']), point(ellipse, ['x2', 'y2'])],
    tip: point(ellipse, ['xPos', 'yPos']),
  };
}
