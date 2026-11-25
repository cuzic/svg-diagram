import type {LayoutCtx} from './layout-ctx.ts';
import {splitAtoms} from './atoms.ts';
import {LINE_HEIGHT_EM, snapGrid} from './layout-util.ts';
import {must} from './must.ts';
import {PALETTE, SHADES, bestTextColor, blendLuminance, paintOf} from './tokens.ts';
import type {LaidOutPyramidLayer, PyramidBand} from './types/figures.ts';
import {wrapAtoms} from './wrap.ts';

export function layoutPyramid(band: PyramidBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const paint = paintOf(ctx.tones, d.appearance);
  const n = band.layers.length;
  const baseWidth = band.width ?? Math.min(cw, 520);
  const apexWidth = baseWidth * band.apexRatio;
  const layerH = band.layerHeight;
  const totalH = n * layerH;
  const cx = padX + cw / 2;
  const layersOut: LaidOutPyramidLayer[] = [];
  for (let i = 0; i < n; i++) { // i=0 is the bottom (widest) layer
    const bottomY = snapGrid(ctx.y) + totalH - i * layerH;
    const topY = bottomY - layerH;
    const bottomW = baseWidth - (baseWidth - apexWidth) * (i / n);
    const topW = baseWidth - (baseWidth - apexWidth) * ((i + 1) / n);
    // Opacity climbs bottom->top using SHADES (see tokens.ts) — the
    // apex (i = n-1) always gets SHADES[0] = fully opaque, matching
    // every hand-authored pyramid/funnel in this deck.
    const opacity = must(SHADES[Math.min(SHADES.length - 1, n - 1 - i)]);
    // bg luminance is a real alpha-blend against white, so the text
    // color choice is provably safe (see tokens.ts's bestTextColor
    // doc comment) without needing a Playwright-rendered check.
    const bgLum = blendLuminance(paint(PALETTE.bg), paint(PALETTE[d.day].accent), opacity);
    const textColor = bestTextColor(bgLum, paint);
    // Wrapped at the narrower (top) edge of this layer, minus padding —
    // conservative since the layer is only wider than that going down,
    // so the label can never spill past the trapezoid's slanted sides.
    const wrapWidth = Math.max(40, topW - 24);
    const atomW = (atom: string) => widthOf(atom, roles.title, 700, 'sans');
    const lines = wrapAtoms(splitAtoms(must(band.layers[i]).text), {maxWidth: wrapWidth, atomWidth: atomW, mode: ctx.wrap});
    const midY = (topY + bottomY) / 2;
    const lineGap = roles.title * LINE_HEIGHT_EM;
    const textYs = lines.map((_, li) => Math.round(midY + (li - (lines.length - 1) / 2) * lineGap + roles.title * 0.35));
    layersOut.push({
      points: [[cx - bottomW / 2, bottomY], [cx + bottomW / 2, bottomY], [cx + topW / 2, topY], [cx - topW / 2, topY]],
      opacity, textColor, lines, textYs, cx,
    });
  }
  ctx.laidOut.push({type: 'pyramid', x: cx - baseWidth / 2, y: snapGrid(ctx.y), w: baseWidth, h: totalH, day: d.day, layers: layersOut});
  ctx.y += totalH + d.gap;
}
