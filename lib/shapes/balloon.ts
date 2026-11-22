// Shared outlines for rectangular, rounded, elliptical and cloud balloons (ADR 0077).
import {f1} from '../comic/constants.ts';

export type Pt = readonly [number, number];
export interface Rect {x: number; y: number; w: number; h: number}
export type BalloonShape = 'rect' | 'round' | 'ellipse' | 'cloud';
export type Side = 'top' | 'right' | 'bottom' | 'left';
export interface BalloonOpts {
  /** Corner radius of 'round'. Defaults to one sixth of the shorter side. */
  radius?: number;
  /** Half the wedge width in follow mode for rect and round. Defaults to clamp(side / 4, 12, 28) / 2. */
  halfWidth?: number;
  /** Follow the tip along the edge, or use the Office preset's fixed base. */
  base?: 'follow' | 'office';
}
interface Dot {c: Pt; r: number}
export interface Balloon {
  /** The closed outline, including the wedge for rect, round and ellipse. */
  d: string;
  /** Where the tail meets the body. For a cloud, both points are the start of the trail. */
  base?: [Pt, Pt];
  tip?: Pt;
  side?: Side;
  /** The cloud's trail, starting at the body. */
  dots?: Dot[];
  /** The distance from the midpoint of the base to the tip. */
  length: number;
  /** The shortest cloud trail that fits the three circles and their clearances. */
  minLength?: number;
  /** The angle of the wedge in degrees. A cloud has no wedge and returns 0. */
  apex: number;
  /** Whether the supplied tip is inside the body. Rect and round use the strict bounding rectangle. */
  inside: boolean;
}

const MAX_INPUT = 1e6;
const CLEAR_MIN = 4;
const CLOUD_GAP = 2;
const DELTA = 11 * Math.PI / 180; // Office wedgeEllipseCallout uses the ellipse parameter.
const f2 = (n: number): number => Math.round(n * 100) / 100;
const svgPoint = ([x, y]: Pt): string => `${f2(x)} ${f2(y)}`;

function validateNumber(name: string, value: number, positive = false): void {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_INPUT || (positive && value <= 0)) {
    const range = positive ? '(0, 1e6]' : '[-1e6, 1e6]';
    throw new RangeError(`${name} must be a finite number in ${range} (got ${value})`);
  }
}

function validateBody({x, y, w, h}: Rect): void {
  validateNumber('body.x', x);
  validateNumber('body.y', y);
  validateNumber('body.w', w, true);
  validateNumber('body.h', h, true);
}

function validateTip(tip: Pt): void {
  validateNumber('tip[0]', tip[0]);
  validateNumber('tip[1]', tip[1]);
}

const noTail = (d: string, inside = false): Balloon => ({d, length: 0, apex: 0, inside});

/** Generate the outline from finite inputs within ±1e6 px and positive dimensions. A non-finite tip omits the tail. */
export function balloonOutline(shape: BalloonShape, body: Rect, tip?: Pt, opts: BalloonOpts = {}): Balloon {
  validateBody(body);
  if (opts.radius !== undefined) validateNumber('radius', opts.radius);
  if (opts.halfWidth !== undefined) validateNumber('halfWidth', opts.halfWidth);
  if (tip && !tip.every(Number.isFinite)) tip = undefined;
  if (tip) validateTip(tip);

  if (shape === 'ellipse') return ellipse(body, tip);
  if (shape === 'cloud') return cloud(body, tip);
  const shortSide = Math.min(body.w, body.h);
  const radius = shape === 'round' ? Math.max(0, Math.min(opts.radius ?? shortSide / 6, shortSide / 2)) : 0;
  return wedgeRect(radius, body, tip, opts);
}

interface Wedge {side: Side; base: [Pt, Pt]; tip: Pt; half: number}

function rectTail(r: number, {x, y, w, h}: Rect, tip: Pt, opts: BalloonOpts): Wedge | undefined {
  const dx = tip[0] - (x + w / 2), dy = tip[1] - (y + h / 2);
  // Office uses top or bottom only when the vertical product is strictly greater.
  const side: Side = Math.abs(dy) * w > Math.abs(dx) * h ? (dy > 0 ? 'bottom' : 'top') : (dx > 0 ? 'right' : 'left');
  const along = side === 'top' || side === 'bottom';
  const sideLength = along ? w : h, start = along ? x : y;
  const clear = Math.max(r, CLEAR_MIN);
  const straight = sideLength - 2 * clear;
  const office = opts.base === 'office';
  const wantedHalf = office ? sideLength / 8 : opts.halfWidth ?? Math.min(Math.max(sideLength / 4, 12), 28) / 2;
  const half = Math.min(wantedHalf, straight / 2);
  if (half < 1) return undefined;

  // Office's base spans either 2/12 to 5/12 or 7/12 to 10/12 of the edge.
  const officeCenter = (along ? dx : dy) > 0 ? 8.5 / 12 : 3.5 / 12;
  const desired = office ? start + officeCenter * sideLength : tip[along ? 0 : 1];
  const t = Math.min(Math.max(desired, start + clear + half), start + sideLength - clear - half);
  const at = (c: number): Pt => {
    if (along) return [c, side === 'top' ? y : y + h];
    return [side === 'left' ? x : x + w, c];
  };
  // List the base points clockwise, in the order the outline reaches them.
  const first = at(t - half), last = at(t + half);
  return {side, base: side === 'top' || side === 'right' ? [first, last] : [last, first], tip, half};
}

function wedgeRect(r: number, body: Rect, tip: Pt | undefined, opts: BalloonOpts): Balloon {
  const {x, y, w, h} = body, right = x + w, bottom = y + h;
  const inside = tip !== undefined && tip[0] > x && tip[0] < right && tip[1] > y && tip[1] < bottom;
  const wedge = tip && !inside ? rectTail(r, body, tip, opts) : undefined;
  const arc = (px: number, py: number): string => r > 0 ? `A${r} ${r} 0 0 1 ${f1(px)} ${f1(py)}` : '';
  const cut = (side: Side): string => wedge?.side === side
    ? [wedge.base[0], wedge.tip, wedge.base[1]].map(([px, py]) => `L${f1(px)} ${f1(py)}`).join('')
    : '';
  const d = `M${f1(x + r)} ${f1(y)}${cut('top')}H${f1(right - r)}${arc(right, y + r)}`
    + `${cut('right')}V${f1(bottom - r)}${arc(right - r, bottom)}`
    + `${cut('bottom')}H${f1(x + r)}${arc(x, bottom - r)}`
    + `${cut('left')}V${f1(y + r)}${arc(x + r, y)}Z`;
  if (!wedge) return noTail(d, inside);

  const round = ([px, py]: Pt): Pt => [f1(px), f1(py)];
  const base: [Pt, Pt] = [round(wedge.base[0]), round(wedge.base[1])];
  const length = tailLength(base, wedge.tip);
  return {d, base, tip: wedge.tip, side: wedge.side, length, apex: apexAngle(wedge.half, length), inside};
}

function tailLength([a, b]: [Pt, Pt], [x, y]: Pt): number {
  return Math.hypot(x - (a[0] + b[0]) / 2, y - (a[1] + b[1]) / 2);
}

const apexAngle = (half: number, length: number): number => 2 * Math.atan2(half, length) * 180 / Math.PI;

function ellipse({x, y, w, h}: Rect, tip?: Pt): Balloon {
  const a = w / 2, c = h / 2, cx = x + a, cy = y + c;
  const at = (u: number): Pt => [cx + a * Math.cos(u), cy + c * Math.sin(u)];
  const arc = `A${f2(a)} ${f2(c)} 0 1 1 `;
  const bodyPath = (): string => `M${svgPoint(at(0))}${arc}${svgPoint(at(Math.PI))}${arc}${svgPoint(at(0))}Z`;
  if (!tip) return noTail(bodyPath());

  const dx = tip[0] - cx, dy = tip[1] - cy;
  // Divide by the full dimensions so a subnormal half-axis cannot cause 0 / 0.
  const inside = (2 * (dx / w)) ** 2 + (2 * (dy / h)) ** 2 < 1;
  if (inside) return noTail(bodyPath(), true);

  const angle = Math.atan2(dy * w, dx * h);
  const p1 = at(angle + DELTA), p2 = at(angle - DELTA);
  const base: [Pt, Pt] = [p1, p2];
  const length = tailLength(base, tip), half = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) / 2;
  return {d: `M${svgPoint(tip)}L${svgPoint(p1)}${arc}${svgPoint(p2)}Z`, base, tip, length, apex: apexAngle(half, length), inside};
}

function cloudParams({x, y, w, h}: Rect) {
  const a0 = w / 2, c0 = h / 2;
  const perimeter = Math.PI * (3 * (a0 + c0) - Math.sqrt((3 * a0 + c0) * (a0 + 3 * c0)));
  const n = Math.max(8, Math.round(perimeter / 46));
  const nominal = perimeter / n;
  const bulge = 0.62 * nominal - Math.sqrt((0.62 * nominal) ** 2 - nominal * nominal / 4);
  const a = Math.max(a0 - bulge, 1), c = Math.max(c0 - bulge, 1);
  const cx = x + a0, cy = y + c0;

  // Sample cumulative arc lengths on the ellipse, then interpolate equally spaced points.
  const samples = 4000, cumulative = [0];
  let px = a, py = 0, total = 0;
  for (let k = 1; k <= samples; k++) {
    const u = 2 * Math.PI * k / samples, qx = a * Math.cos(u), qy = c * Math.sin(u);
    total += Math.hypot(qx - px, qy - py);
    cumulative.push(total);
    px = qx;
    py = qy;
  }
  const first: Pt = [cx + a, cy], pts: Pt[] = [first];
  let k = 0, lower = 0, upper = cumulative[1] ?? total;
  for (let i = 1; i < n; i++) {
    const target = total * i / n;
    while (upper < target) {
      lower = upper;
      k++;
      upper = cumulative[k + 1] ?? total;
    }
    const u = 2 * Math.PI * (k + (target - lower) / (upper - lower)) / samples;
    pts.push([cx + a * Math.cos(u), cy + c * Math.sin(u)]);
  }
  // Every arc has its own radius, so it can span its chord at any aspect ratio.
  const arcs = pts.map((from, i) => {
    const to = pts[i + 1] ?? first;
    return {from, to, radius: 0.62 * Math.hypot(to[0] - from[0], to[1] - from[1])};
  });
  return {cx, cy, first, arcs};
}

function sampleCloud({cx, cy, arcs}: ReturnType<typeof cloudParams>, per = 16): Pt[] {
  const poly: Pt[] = [];
  for (const {from: p0, to: p1, radius: r} of arcs) {
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], chord = Math.hypot(dx, dy);
    const offset = Math.sqrt(Math.max(r * r - chord * chord / 4, 0));
    let nx = -dy / chord, ny = dx / chord;
    if (nx * (mx - cx) + ny * (my - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const arcX = mx - nx * offset, arcY = my - ny * offset;
    const start = Math.atan2(p0[1] - arcY, p0[0] - arcX);
    let sweep = Math.atan2(p1[1] - arcY, p1[0] - arcX) - start;
    if (sweep <= -Math.PI) sweep += 2 * Math.PI;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    for (let k = 0; k < per; k++) {
      const u = start + sweep * k / per;
      poly.push([arcX + r * Math.cos(u), arcY + r * Math.sin(u)]);
    }
  }
  return poly;
}

/** Sample the actual cloud outline at per points per arc. */
export function cloudPolygon(body: Rect, per = 16): Pt[] {
  validateBody(body);
  return sampleCloud(cloudParams(body), per);
}

function insidePolygon([x, y]: Pt, poly: Pt[]): boolean {
  let prev = poly.at(-1);
  if (!prev) return false;
  let inside = false;
  for (const point of poly) {
    const [ax, ay] = prev, [bx, by] = point;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    prev = point;
  }
  return inside;
}

function distanceToPolygon([x, y]: Pt, poly: Pt[]): number {
  let prev = poly.at(-1);
  let best = Infinity;
  if (!prev) return best;
  for (const point of poly) {
    const [ax, ay] = prev, [bx, by] = point;
    const dx = bx - ax, dy = by - ay;
    const t = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0), 1);
    best = Math.min(best, (x - (ax + dx * t)) ** 2 + (y - (ay + dy * t)) ** 2);
    prev = point;
  }
  return Math.sqrt(best);
}

/** The three Office trail radii, from body to tip. */
export function cloudRadii(ss: number): [number, number, number] {
  validateNumber('ss', ss, true);
  return [ss / 12, ss / 18, ss / 36];
}

function rayCrossings(poly: Pt[], cx: number, cy: number, dx: number, dy: number): number[] {
  const crossings: number[] = [];
  let prev = poly.at(-1);
  if (!prev) return crossings;
  for (const point of poly) {
    const [x0, y0] = prev, [x1, y1] = point;
    prev = point;
    const ex = x1 - x0, ey = y1 - y0;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((x0 - cx) * ey - (y0 - cy) * ex) / den;
    const s = ((x0 - cx) * dy - (y0 - cy) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1) crossings.push(t);
  }
  return crossings;
}

function cloud(body: Rect, tip?: Pt): Balloon {
  const params = cloudParams(body);
  const {cx, cy, first, arcs} = params;
  const parts = [`M${svgPoint(first)}`];
  for (const {to, radius} of arcs) {
    const r = f2(radius);
    parts.push(`A${r} ${r} 0 0 1 ${svgPoint(to)}`);
  }
  const d = parts.join('') + 'Z';
  if (!tip) return noTail(d);

  const poly = sampleCloud(params);
  const dx = tip[0] - cx, dy = tip[1] - cy, reach = Math.hypot(dx, dy);
  if (reach === 0 || insidePolygon(tip, poly)) return noTail(d, true);
  const ux = dx / reach, uy = dy / reach;
  // The ray can cross the outline again beyond a tip in a notch.
  const exit = rayCrossings(poly, cx, cy, ux, uy).reduce((last, t) => t <= reach ? Math.max(last, t) : last, 0);
  const e: Pt = [cx + ux * exit, cy + uy * exit];
  const length = reach - exit;
  const [r1, r2, r3] = cloudRadii(Math.min(body.w, body.h));
  const at = (s: number): Pt => [e[0] + ux * s, e[1] + uy * s];

  // Move the first circle outward until it clears nearby bumps by 2 px.
  const clear = r1 + CLOUD_GAP;
  let s1 = clear;
  for (let gap = clear - distanceToPolygon(at(s1), poly); gap > 0; gap = clear - distanceToPolygon(at(s1), poly)) {
    // Distance can increase by at most the step, so skip quarter-pixel steps that cannot clear the outline.
    s1 += Math.max(1, Math.ceil(gap * 4)) / 4;
  }
  const afterFirst = s1 + r1 + r2 + CLOUD_GAP;
  const minLength = afterFirst + r2 + r3 + CLOUD_GAP;
  const s2 = Math.max((s1 + length) / 2, afterFirst);
  // A short trail can lose clearance, but its dots must never pass the tip.
  const dotAt = (s: number): Pt => s < length ? at(s) : tip;
  const dots = [{c: dotAt(s1), r: r1}, {c: dotAt(s2), r: r2}, {c: tip, r: r3}];
  return {d, base: [e, e], tip, dots, length, minLength, apex: 0, inside: false};
}

/** Largest centred rectangle in the body's proportions with its corners and side midpoints inside the cloud. */
export function cloudTextRect(body: Rect): Rect {
  const poly = cloudPolygon(body);
  const {x, y, w, h} = body, cx = x + w / 2, cy = y + h / 2;
  const hw = w / 2, hh = h / 2;
  const offsets: Pt[] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [0, -hh], [hw, 0], [0, hh], [-hw, 0]];
  const fits = (scale: number): boolean => offsets.every(([dx, dy]) => insidePolygon([cx + dx * scale, cy + dy * scale], poly));
  if (fits(1)) return {...body};

  // A corner can leave the cloud between bumps and re-enter it. Try intervals from the outside in.
  const bounds = offsets.flatMap(([dx, dy]) => rayCrossings(poly, cx, cy, dx, dy)).filter(t => t < 1);
  bounds.push(0);
  bounds.sort((a, b) => b - a);
  let lo = 0, hi = 1;
  for (const bound of bounds) {
    const mid = (bound + hi) / 2;
    if (fits(mid)) {
      lo = mid;
      break;
    }
    hi = bound;
  }
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return {x: cx - hw * lo, y: cy - hh * lo, w: w * lo, h: h * lo};
}

/** Office adjustments express the offset from the centre in 1/100000 of the width and height. A non-finite tip has no adjustments. */
export function officeAdj(body: Rect, tip: Pt): [number, number] | undefined {
  validateBody(body);
  if (!tip.every(Number.isFinite)) return undefined;
  validateTip(tip);
  const {x, y, w, h} = body;
  return [Math.round((tip[0] - (x + w / 2)) / w * 100000), Math.round((tip[1] - (y + h / 2)) / h * 100000)];
}
