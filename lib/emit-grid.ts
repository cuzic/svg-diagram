import {renderBox} from './emit-box.ts';
import {visibleAt} from './reveal-visibility.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutGrid} from './types/containers.ts';
import type {Roles, Theme} from './types/core.ts';

export function renderGrid(band: LaidOutGrid, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string {
  return band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, tones, roles)).join('\n\n  ');
}
