import {dimChildren} from './emit-spotlight.ts';
import type {SpotlightHooks} from './band-def.ts';
import {renderBox} from './emit-box.ts';
import {visibleAt} from './reveal-visibility.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutGrid, GridBand} from './types/containers.ts';
import type {Roles, Theme} from './types/core.ts';

export function renderGrid(band: LaidOutGrid, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string {
  return band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, tones, roles)).join('\n\n  ');
}

export const gridSpotlight: SpotlightHooks<GridBand, LaidOutGrid> = {
  targets: (band, id) => band.children.filter(c => c.id === id),
  dim: dimChildren,
};
