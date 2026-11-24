import {renderBox} from './emit-box.ts';
import {childTextSvgDefs} from './emit-box-defs.ts';
import {snap4} from './emit-common.ts';
import type {SvgBandDefs} from './emit-svg-core.ts';
import {must} from './must.ts';
import {visibleAt} from './reveal-visibility.ts';
import {PALETTE} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutRow} from './types/containers.ts';
import type {Roles, Theme} from './types/core.ts';

export function rowSvgDefs(band: LaidOutRow): SvgBandDefs {
  return {...childTextSvgDefs(band), arrow: band.arrows.length > 0};
}

export function renderRow(band: LaidOutRow, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string {
  const boxes = band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, tones, roles)).join('\n\n  ');
  const arrows = band.arrows.filter((_, i) => visibleAt(must(band.children[i]), stage) && visibleAt(must(band.children[i + 1]), stage)).map(a =>
    `<path d="M${snap4(a.x1)},${Math.round(a.y1)} L${snap4(a.x2)},${Math.round(a.y2)}" fill="none" stroke="${band.dim ? PALETTE.muted : PALETTE.text}" stroke-width="2.5" marker-end="url(#${band.dim ? 'dsl-arrow-dim' : 'dsl-arrow'})"/>`,
  ).join('\n  ');
  return arrows ? `${boxes}\n\n  ${arrows}` : boxes;
}
