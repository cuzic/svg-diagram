
import type {LaidOutMath} from './types/math.ts';
import {escapeAttr} from './emit-common.ts';

// math(): the formula's outlines, scaled to the band's font size. The group is marked (data-math ... <!--/math-->) so lint-svg.ts can tell the
// formula's own nested groups from shapes an author placed.
export function renderMath(band: LaidOutMath): string {
  const n = (v: number) => +v.toFixed(2);
  const top = band.y + (band.h - band.drawnH) / 2;
  return `<g data-math="" role="img" aria-label="${escapeAttr(band.alt)}" transform="translate(${n(band.x)} ${n(top)}) scale(${+band.scale.toFixed(6)})" fill="${band.color}" stroke="${band.color}" stroke-width="0">${band.inner}</g><!--/math-->`;
}
