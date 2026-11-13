// An SVG path's `d` as the steps of a DrawingML freeform: M, L, H, V, C, S, Q, T, A and Z, absolute or relative. Arcs become cubic
// curves (at most 90 degrees each), smooth curves get their reflected control point, and every point is absolute.
import type {PathStep} from './connectors.ts';

type P = {x: number; y: number};

/** The cubic curves of an SVG arc from `a` to `b` (SVG implementation notes, F.6.5), each at most a quarter turn. */
function arcToCubics(a: P, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, b: P): P[][] {
  if (rx === 0 || ry === 0 || (a.x === b.x && a.y === b.y)) return [[a, b, b]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = phiDeg * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (a.x - b.x) / 2, dy = (a.y - b.y) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = k * rx * y1 / ry, cy1 = -k * ry * x1 / rx;
  const cx = cos * cx1 - sin * cy1 + (a.x + b.x) / 2, cy = sin * cx1 + cos * cy1 + (a.y + b.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9)), step = dt / n, kappa = 4 / 3 * Math.tan(step / 4);
  const at = (t: number): P => ({x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos});
  const tangent = (t: number): P => ({x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos});
  const out: P[][] = [];
  for (let i = 0; i < n; i++) {
    const s = t1 + i * step, e = s + step, p0 = at(s), p3 = at(e), d0 = tangent(s), d3 = tangent(e);
    out.push([{x: p0.x + kappa * d0.x, y: p0.y + kappa * d0.y}, {x: p3.x - kappa * d3.x, y: p3.y - kappa * d3.y}, i === n - 1 ? b : p3]);
  }
  return out;
}

/** The steps of `d`, and whether it closes (Z) — a closed path is a shape that can be filled. */
export function svgPathSteps(d: string): {steps: PathStep[]; closed: boolean} {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const steps: PathStep[] = [];
  let i = 0, cmd = '', cur: P = {x: 0, y: 0}, start: P = {x: 0, y: 0}, lastCtrl: P | undefined, lastCmd = '', closed = false;
  const num = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i] ?? '')) cmd = tokens[i++] ?? '';
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const pt = (): P => { const x = num(), y = num(); return rel ? {x: cur.x + x, y: cur.y + y} : {x, y}; };
    if (C === 'Z') { steps.push({op: 'Z', pts: []}); cur = start; closed = true; lastCmd = 'Z'; continue; }
    if (C === 'M') { cur = start = pt(); steps.push({op: 'M', pts: [cur]}); cmd = rel ? 'l' : 'L'; lastCmd = 'M'; continue; }
    if (C === 'L') { cur = pt(); steps.push({op: 'L', pts: [cur]}); }
    else if (C === 'H') { const x = num(); cur = {x: rel ? cur.x + x : x, y: cur.y}; steps.push({op: 'L', pts: [cur]}); }
    else if (C === 'V') { const y = num(); cur = {x: cur.x, y: rel ? cur.y + y : y}; steps.push({op: 'L', pts: [cur]}); }
    else if (C === 'C' || C === 'S') {
      const c1 = C === 'C' ? pt() : lastCtrl && /[CS]/.test(lastCmd) ? {x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y} : cur;
      const c2 = pt(), e = pt();
      steps.push({op: 'C', pts: [c1, c2, e]}); lastCtrl = c2; cur = e; lastCmd = 'C'; continue;
    } else if (C === 'Q' || C === 'T') {
      const c = C === 'Q' ? pt() : lastCtrl && /[QT]/.test(lastCmd) ? {x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y} : cur;
      const e = pt();
      steps.push({op: 'Q', pts: [c, e]}); lastCtrl = c; cur = e; lastCmd = 'Q'; continue;
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num(), large = num() !== 0, sweep = num() !== 0, e = pt();
      for (const c of arcToCubics(cur, rx, ry, rot, large, sweep, e)) steps.push({op: 'C', pts: c});
      cur = e;
    } else throw new Error(`svgPathSteps: unsupported path command "${cmd}"`);
    lastCmd = C;
  }
  return {steps, closed};
}
