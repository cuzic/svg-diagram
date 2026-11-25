import type {LayoutCtx} from './layout-ctx.ts';
import {snapGrid} from './layout-util.ts';
import type {CurveBand} from './types/figures.ts';

export function layoutCurve(band: CurveBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const w = band.width ?? cw;
  const h = band.height;
  const x = padX + (cw - w) / 2;
  const y = snapGrid(ctx.y);
  const AXIS_LABEL_W = 44, AXIS_BOTTOM_GAP = 28, TOP_PAD = 14, RIGHT_PAD = 8;
  const axisX = x + AXIS_LABEL_W;
  const axisRight = x + w - RIGHT_PAD;
  const axisTop = y + TOP_PAD;
  const axisBottom = y + h - AXIS_BOTTOM_GAP;
  const n = band.points.length;
  const points = band.points.map((p, i) => ({
    x: n === 1 ? axisX : axisX + i * (axisRight - axisX) / (n - 1),
    y: axisBottom - Math.max(0, Math.min(1, p.y)) * (axisBottom - axisTop),
    emphasis: p.emphasis,
    dropLine: !!p.dropLine,
  }));
  ctx.laidOut.push({
    type: 'curve', x, y, w, h, axisX, axisRight, axisTop, axisBottom, points,
    yTopLabel: band.yTopLabel, yBottomLabel: band.yBottomLabel, xLabel: band.xLabel,
  });
  ctx.y += h + d.gap;
}
